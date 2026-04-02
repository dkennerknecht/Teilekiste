import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import {
  idPayloadSchema,
  storageBinCreateSchema,
  storageBinUpdateSchema
} from "@/lib/validation";
import { parseJson } from "@/lib/http";
import {
  applyStorageBinSlotCountChange,
  findStorageBinCodeConflict,
  formatStorageBinLabel,
  isManagedStorageBinCode,
  mapPlacementError,
  normalizeStorageBinCode
} from "@/lib/storage-bins";

async function validateStorageBinShelf(storageShelfId: string) {
  const shelf = await prisma.storageShelf.findUnique({
    where: { id: storageShelfId },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      }
    }
  });
  if (!shelf) {
    throw new Error("PLACEMENT_SHELF_INVALID");
  }
  if (shelf.mode !== "DRAWER_HOST") {
    throw new Error("PLACEMENT_SHELF_OPEN_AREA_ONLY");
  }
  return shelf;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const bins = await prisma.storageBin.findMany({
      include: {
        storageLocation: {
          select: { id: true, name: true, code: true }
        },
        storageShelf: {
          select: { id: true, name: true, code: true, mode: true }
        },
        _count: {
          select: {
            items: {
              where: {
                deletedAt: null,
                isArchived: false,
                mergedIntoItemId: null
              }
            }
          }
        }
      },
      orderBy: [{ storageLocation: { name: "asc" } }, { storageShelf: { code: "asc" } }, { code: "asc" }]
    });

  return NextResponse.json(
    bins.map((bin) => {
      const code = normalizeStorageBinCode(bin.code) || bin.code;
      return {
        ...bin,
        code,
        fullCode: formatStorageBinLabel({
          shelfCode: bin.storageShelf?.code || null,
          binCode: code
        })
      };
    })
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, storageBinCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof storageBinCreateSchema.parse>;

  try {
    const validatedShelf = await validateStorageBinShelf(body.storageShelfId);
    const normalizedCode = normalizeStorageBinCode(body.code)!;
    if (!isManagedStorageBinCode(normalizedCode)) {
      return NextResponse.json({ error: "Drawer-Code muss aus zwei Ziffern von 01 bis 99 bestehen" }, { status: 400 });
    }
    const conflictingBin = await findStorageBinCodeConflict(prisma, normalizedCode, validatedShelf.id);
    if (conflictingBin) {
      return NextResponse.json({ error: "Drawer-Code ist bereits vorhanden" }, { status: 409 });
    }

    const storageBin = await prisma.storageBin.create({
      data: {
        code: normalizedCode,
        storageLocationId: validatedShelf.storageLocationId,
        storageShelfId: validatedShelf.id,
        storageArea: validatedShelf.name,
        slotCount: body.slotCount,
        isActive: body.isActive ?? true
      },
      include: {
        storageLocation: {
          select: { id: true, name: true, code: true }
        },
        storageShelf: {
          select: { id: true, name: true, code: true, mode: true }
        }
      }
    });
    return NextResponse.json(
      {
        ...storageBin,
        fullCode: formatStorageBinLabel({
          shelfCode: storageBin.storageShelf?.code || null,
          binCode: storageBin.code
        })
      },
      { status: 201 }
    );
  } catch (error) {
    const placementError = mapPlacementError(error);
    if (placementError) {
      return NextResponse.json(placementError.body, { status: placementError.status });
    }
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, storageBinUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof storageBinUpdateSchema.parse>;
  const existing = await prisma.storageBin.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const nextStorageShelfId = body.storageShelfId || existing.storageShelfId;
    const validatedShelf = await validateStorageBinShelf(nextStorageShelfId);
    const normalizedCode =
      body.code !== undefined ? normalizeStorageBinCode(body.code)! : normalizeStorageBinCode(existing.code)!;
    if (!isManagedStorageBinCode(normalizedCode)) {
      return NextResponse.json({ error: "Drawer-Code muss aus zwei Ziffern von 01 bis 99 bestehen" }, { status: 400 });
    }
    const conflictingBin = await findStorageBinCodeConflict(prisma, normalizedCode, validatedShelf.id, existing.id);
    if (conflictingBin) {
      return NextResponse.json({ error: "Drawer-Code ist bereits vorhanden" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.slotCount !== undefined && body.slotCount !== existing.slotCount) {
        await applyStorageBinSlotCountChange(tx, {
          id: existing.id,
          slotCount: body.slotCount
        });
      }
      return tx.storageBin.update({
        where: { id: existing.id },
        data: {
          code: body.code !== undefined ? normalizedCode : undefined,
          storageLocationId: validatedShelf.storageLocationId,
          storageShelfId: validatedShelf.id,
          storageArea: validatedShelf.name,
          slotCount: body.slotCount,
          isActive: body.isActive
        },
        include: {
          storageLocation: {
            select: { id: true, name: true, code: true }
          },
          storageShelf: {
            select: { id: true, name: true, code: true, mode: true }
          }
        }
      });
    });
    return NextResponse.json({
      ...updated,
      fullCode: formatStorageBinLabel({
        shelfCode: updated.storageShelf?.code || null,
        binCode: updated.code
      })
    });
  } catch (error) {
    const placementError = mapPlacementError(error);
    if (placementError) {
      return NextResponse.json(placementError.body, { status: placementError.status });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, idPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { id } = parsed.data as ReturnType<typeof idPayloadSchema.parse>;

  const activeItemCount = await prisma.item.count({
    where: {
      storageBinId: id,
      deletedAt: null,
      isArchived: false,
      mergedIntoItemId: null
    }
  });
  if (activeItemCount > 0) {
    return NextResponse.json({ error: "Drawer ist noch belegt und kann nicht geloescht werden" }, { status: 409 });
  }

  await prisma.storageBin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
