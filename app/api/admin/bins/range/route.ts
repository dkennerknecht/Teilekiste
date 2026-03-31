import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { storageBinRangeCreateSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";
import { mapPlacementError, normalizeOptionalText, normalizeStorageBinCode } from "@/lib/storage-bins";

async function validateStorageBinLocation(storageLocationId: string, storageArea?: string | null) {
  const location = await prisma.storageLocation.findUnique({
    where: { id: storageLocationId },
    select: { id: true }
  });
  if (!location) {
    throw new Error("PLACEMENT_LOCATION_NOT_FOUND");
  }
  const normalizedStorageArea = normalizeOptionalText(storageArea);
  if (normalizedStorageArea) {
    const shelf = await prisma.storageShelf.findFirst({
      where: { storageLocationId, name: normalizedStorageArea },
      select: { id: true }
    });
    if (!shelf) {
      throw new Error("PLACEMENT_SHELF_INVALID");
    }
  }
  return normalizedStorageArea;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, storageBinRangeCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof storageBinRangeCreateSchema.parse>;

  try {
    const storageArea = await validateStorageBinLocation(body.storageLocationId, body.storageArea);
    const requestedCodes = Array.from({ length: body.end - body.start + 1 }, (_, index) =>
      normalizeStorageBinCode(`${body.prefix}${body.start + index}`)!
    );
    const existing = await prisma.storageBin.findMany({
      where: { code: { in: requestedCodes } },
      select: { code: true }
    });
    const existingCodeSet = new Set(existing.map((entry) => entry.code));
    const missingCodes = requestedCodes.filter((code) => !existingCodeSet.has(code));

    const created = await prisma.$transaction(
      missingCodes.map((code) =>
        prisma.storageBin.create({
          data: {
            code,
            storageLocationId: body.storageLocationId,
            storageArea,
            slotCount: body.slotCount
          }
        })
      )
    );

    return NextResponse.json({
      requestedCount: requestedCodes.length,
      createdCount: created.length,
      existingCount: existing.length,
      createdCodes: created.map((entry) => entry.code),
      existingCodes: existing.map((entry) => entry.code)
    });
  } catch (error) {
    const placementError = mapPlacementError(error);
    if (placementError) {
      return NextResponse.json(placementError.body, { status: placementError.status });
    }
    throw error;
  }
}
