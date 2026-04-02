import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { serializeStoredQuantity } from "@/lib/quantity";
import { getAvailableQty, getReservedQty } from "@/lib/stock";
import { findStorageBinByCode, formatItemPosition } from "@/lib/storage-bins";
import { formatStorageBinLabel } from "@/lib/storage-labels";

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const matchedStorageBin = await findStorageBinByCode(prisma, params.code);
  if (!matchedStorageBin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storageBin = await prisma.storageBin.findUnique({
    where: { id: matchedStorageBin.id },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      storageShelf: {
        select: { id: true, name: true, code: true, description: true, mode: true }
      },
      items: {
        where: {
          deletedAt: null,
          isArchived: false,
          mergedIntoItemId: null
        },
        include: {
          category: true,
          storageLocation: {
            select: { id: true, name: true, code: true }
          },
          storageShelf: {
            select: { id: true, name: true, code: true }
          },
          storageBin: {
            select: { id: true, code: true }
          },
          reservations: { select: { reservedQty: true } },
          images: {
            select: { path: true, thumbPath: true, caption: true, isPrimary: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1
          }
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

  const occupiedSlots = new Set(
    storageBin.items
      .map((item) => (typeof item.binSlot === "number" ? item.binSlot : storageBin.slotCount <= 1 ? 1 : null))
      .filter((value): value is number => typeof value === "number")
  );
  const freeSlots = Array.from({ length: storageBin.slotCount }, (_, index) => index + 1).filter((slot) => !occupiedSlots.has(slot));

  return NextResponse.json({
    ...storageBin,
    fullCode:
      formatStorageBinLabel({
        shelfCode: storageBin.storageShelf?.code || null,
        binCode: storageBin.code
      }) || storageBin.code,
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
        primaryImage: item.images[0] ?? null,
        displayPosition: formatItemPosition(item)
      };
    })
  });
}
