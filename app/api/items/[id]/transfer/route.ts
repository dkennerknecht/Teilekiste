import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { itemTransferSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";
import { canWrite, resolveAllowedLocationIds } from "@/lib/permissions";
import { serializeStoredQuantity } from "@/lib/quantity";
import { applyItemTransfer, validateTransferTarget } from "@/lib/item-transfer";

function mapTransferError(error: unknown) {
  switch ((error as Error).message) {
    case "TRANSFER_TARGET_FORBIDDEN":
      return { status: 403, body: { error: "Forbidden" } };
    case "TRANSFER_TARGET_LOCATION_NOT_FOUND":
      return { status: 400, body: { error: "Ziel-Lagerort nicht gefunden" } };
    case "TRANSFER_TARGET_SHELF_INVALID":
      return { status: 400, body: { error: "Regal/Bereich ist fuer den Ziel-Lagerort ungueltig" } };
    default:
      return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, itemTransferSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof itemTransferSchema.parse>;

  const item = await prisma.item.findUnique({
    where: { id: params.id },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      }
    }
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (item.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!item.storageLocationId && auth.user!.role !== "ADMIN" && !canWrite(auth.user!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (item.storageBinId) {
    const siblingCount = await prisma.item.count({
      where: {
        storageBinId: item.storageBinId,
        id: { not: item.id },
        deletedAt: null,
        isArchived: false,
        mergedIntoItemId: null
      }
    });
    if (siblingCount > 0) {
      return NextResponse.json(
        { error: "Ein einzelnes Item kann nicht direkt aus einem mehrfach belegten Drawer transferiert werden" },
        { status: 409 }
      );
    }
  }

  try {
    const validatedTarget = await validateTransferTarget(prisma, {
      storageLocationId: body.storageLocationId,
      storageArea: body.storageArea,
      allowedLocationIds
    });
    const result = await prisma.$transaction(async (tx) =>
      applyItemTransfer(tx, {
        item,
        target: {
          storageLocationId: body.storageLocationId,
          storageArea: validatedTarget.storageArea,
          bin: body.bin
        },
        userId: auth.user!.id,
        note: body.note,
        sourceLocation: item.storageLocation,
        targetLocation: validatedTarget.location
      })
    );
    const transferredItem = result.item as typeof item;

    return NextResponse.json({
      ...transferredItem,
      stock: serializeStoredQuantity(transferredItem.unit, transferredItem.stock),
      minStock: serializeStoredQuantity(transferredItem.unit, transferredItem.minStock),
      transferred: result.changed
    });
  } catch (error) {
    const mapped = mapTransferError(error);
    if (mapped) {
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
    throw error;
  }
}
