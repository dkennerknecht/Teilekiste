import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { serializeStoredQuantity } from "@/lib/quantity";
import { getAvailableQty, getReservedQty } from "@/lib/stock";
import { formatItemPosition, normalizeStorageBinCode } from "@/lib/storage-bins";

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const code = normalizeStorageBinCode(params.code);
  if (!code) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storageBin = await prisma.storageBin.findUnique({
    where: { code },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      items: {
        where: {
          deletedAt: null,
          isArchived: false,
          mergedIntoItemId: null
        },
        include: {
          category: true,
          reservations: { select: { reservedQty: true } }
        },
        orderBy: [{ binSlot: "asc" }, { labelCode: "asc" }]
      }
    }
  });
  if (!storageBin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(storageBin.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const occupiedSlots = new Set(storageBin.items.map((item) => item.binSlot).filter((value): value is number => typeof value === "number"));
  const freeSlots = Array.from({ length: storageBin.slotCount }, (_, index) => index + 1).filter((slot) => !occupiedSlots.has(slot));

  return NextResponse.json({
    ...storageBin,
    freeSlots,
    items: storageBin.items.map((item) => {
      const reservedQty = getReservedQty(item.reservations);
      return {
        ...item,
        stock: serializeStoredQuantity(item.unit, item.stock),
        incomingQty: serializeStoredQuantity(item.unit, item.incomingQty),
        minStock: serializeStoredQuantity(item.unit, item.minStock),
        reservedQty: serializeStoredQuantity(item.unit, reservedQty),
        availableStock: serializeStoredQuantity(item.unit, getAvailableQty(item.stock, reservedQty, item.placementStatus)),
        displayBin: formatItemPosition(item)
      };
    })
  });
}
