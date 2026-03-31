import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { getAvailableQty, getReservedQty } from "@/lib/stock";
import { serializeStoredQuantity } from "@/lib/quantity";
import { formatItemPosition } from "@/lib/storage-bins";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const shelf = await prisma.storageShelf.findUnique({
    where: { id: params.id },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      bins: {
        where: { isActive: true },
        include: {
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
      },
      items: {
        where: {
          deletedAt: null,
          isArchived: false,
          mergedIntoItemId: null,
          storageBinId: null
        },
        include: {
          storageLocation: {
            select: { id: true, name: true, code: true }
          },
          storageShelf: {
            select: { id: true, name: true, code: true }
          },
          reservations: { select: { reservedQty: true } }
        },
        orderBy: [{ labelCode: "asc" }]
      }
    }
  });
  if (!shelf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(shelf.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    ...shelf,
    items: shelf.items.map((item) => {
      const reservedQty = getReservedQty(item.reservations);
      return {
        ...item,
        stock: serializeStoredQuantity(item.unit, item.stock),
        incomingQty: serializeStoredQuantity(item.unit, item.incomingQty),
        minStock: serializeStoredQuantity(item.unit, item.minStock),
        reservedQty: serializeStoredQuantity(item.unit, reservedQty),
        availableStock: serializeStoredQuantity(item.unit, getAvailableQty(item.stock, reservedQty, item.placementStatus)),
        displayPosition: formatItemPosition(item)
      };
    })
  });
}
