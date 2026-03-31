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
  mapPlacementError,
  normalizeOptionalText,
  normalizeStorageBinCode
} from "@/lib/storage-bins";

async function validateStorageBinLocation(storageLocationId: string, storageArea?: string | null) {
  const location = await prisma.storageLocation.findUnique({
    where: { id: storageLocationId },
    select: { id: true, name: true, code: true }
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
  return { location, storageArea: normalizedStorageArea };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  return NextResponse.json(
    await prisma.storageBin.findMany({
      include: {
        storageLocation: {
          select: { id: true, name: true, code: true }
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
      orderBy: [{ code: "asc" }]
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
    const validated = await validateStorageBinLocation(body.storageLocationId, body.storageArea);
    const storageBin = await prisma.storageBin.create({
      data: {
        code: normalizeStorageBinCode(body.code)!,
        storageLocationId: body.storageLocationId,
        storageArea: validated.storageArea,
        slotCount: body.slotCount,
        isActive: body.isActive ?? true
      },
      include: {
        storageLocation: {
          select: { id: true, name: true, code: true }
        }
      }
    });
    return NextResponse.json(storageBin, { status: 201 });
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
    const nextStorageLocationId = body.storageLocationId || existing.storageLocationId;
    const nextStorageArea =
      body.storageArea !== undefined ? body.storageArea : existing.storageArea;
    const validated = await validateStorageBinLocation(nextStorageLocationId, nextStorageArea);

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
          code: body.code !== undefined ? normalizeStorageBinCode(body.code)! : undefined,
          storageLocationId: nextStorageLocationId,
          storageArea: validated.storageArea,
          slotCount: body.slotCount,
          isActive: body.isActive
        },
        include: {
          storageLocation: {
            select: { id: true, name: true, code: true }
          }
        }
      });
    });
    return NextResponse.json(updated);
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
