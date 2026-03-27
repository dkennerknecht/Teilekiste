import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { getAvailableQty, getReservedQty } from "@/lib/stock";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const rows = await prisma.item.findMany({
    where: {
      deletedAt: null,
      isArchived: false,
      minStock: { not: null },
      storageLocationId: allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined
    },
    include: {
      storageLocation: true,
      reservations: { select: { reservedQty: true } }
    },
    orderBy: [{ storageLocation: { name: "asc" } }, { labelCode: "asc" }],
    take: 1000
  });

  const items = rows
    .map((item) => {
      const reserved = getReservedQty(item.reservations);
      const available = getAvailableQty(item.stock, reserved);
      const min = item.minStock || 0;
      const needed = Math.max(0, min - available);
      const targetQty = Math.max(min * 2, min + needed);
      return {
        id: item.id,
        labelCode: item.labelCode,
        name: item.name,
        stock: item.stock,
        available,
        reserved,
        minStock: min,
        needed,
        targetQty,
        unit: item.unit,
        storageLocation: item.storageLocation.name,
        manufacturer: item.manufacturer,
        mpn: item.mpn
      };
    })
    .filter((row) => row.needed > 0);

  return NextResponse.json({ items, total: items.length });
}
