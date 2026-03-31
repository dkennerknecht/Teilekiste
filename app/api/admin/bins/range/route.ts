import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { storageBinRangeCreateSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";
import { findStorageBinCodeConflict, isManagedStorageBinCode, mapPlacementError, normalizeStorageBinCode } from "@/lib/storage-bins";

async function validateStorageBinShelf(storageShelfId: string) {
  const shelf = await prisma.storageShelf.findUnique({
    where: { id: storageShelfId },
    select: { id: true, name: true, mode: true, storageLocationId: true }
  });
  if (!shelf) {
    throw new Error("PLACEMENT_SHELF_INVALID");
  }
  if (shelf.mode !== "DRAWER_HOST") {
    throw new Error("PLACEMENT_SHELF_OPEN_AREA_ONLY");
  }
  return shelf;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, storageBinRangeCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof storageBinRangeCreateSchema.parse>;

  try {
    const shelf = await validateStorageBinShelf(body.storageShelfId);
    const requestedCodes = Array.from({ length: body.end - body.start + 1 }, (_, index) => {
      const code = normalizeStorageBinCode(`${body.prefix}${body.start + index}`)!;
      if (!isManagedStorageBinCode(code)) {
        throw new Error("PLACEMENT_BIN_INVALID_CODE");
      }
      return code;
    });
    const existing = await prisma.storageBin.findMany({
      where: { storageShelfId: shelf.id },
      select: { code: true }
    });
    const existingCodeSet = new Set(existing.map((entry) => normalizeStorageBinCode(entry.code) || entry.code));
    const missingCodes = requestedCodes.filter((code) => !existingCodeSet.has(code));
    const existingCodes = requestedCodes.filter((code) => existingCodeSet.has(code));

    for (const code of missingCodes) {
      const conflict = await findStorageBinCodeConflict(prisma, code, shelf.id);
      if (conflict) {
        existingCodes.push(code);
      }
    }
    const finalMissingCodes = missingCodes.filter((code) => !existingCodes.includes(code));

    const created = await prisma.$transaction(
      finalMissingCodes.map((code) =>
        prisma.storageBin.create({
          data: {
            code,
            storageLocationId: shelf.storageLocationId,
            storageShelfId: shelf.id,
            storageArea: shelf.name,
            slotCount: body.slotCount
          }
        })
      )
    );

    return NextResponse.json({
      requestedCount: requestedCodes.length,
      createdCount: created.length,
      existingCount: existingCodes.length,
      createdCodes: created.map((entry) => entry.code),
      existingCodes
    });
  } catch (error) {
    const placementError = mapPlacementError(error);
    if (placementError) {
      return NextResponse.json(placementError.body, { status: placementError.status });
    }
    if ((error as Error).message === "PLACEMENT_BIN_INVALID_CODE") {
      return NextResponse.json({ error: "Drawer-Code muss dem Muster A01 bis Z99 entsprechen" }, { status: 400 });
    }
    throw error;
  }
}
