import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { getAvailableQty, getReservedQty } from "@/lib/stock";
import { serializeStoredQuantity } from "@/lib/quantity";
import { formatItemPosition } from "@/lib/storage-bins";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      isArchived: false,
      storageLocationId: allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined
    },
    include: { category: true, labelType: true, storageLocation: true, tags: { include: { tag: true } }, reservations: true }
  });

  const delimiter = req.nextUrl.searchParams.get("delimiter") || ",";
  const lowStockOnly = req.nextUrl.searchParams.get("lowStock") === "1";
  const csv = toCsv(
    items.map((item) => {
      const reserved = getReservedQty(item.reservations);
      return {
        id: item.id,
        labelCode: item.labelCode,
        name: item.name,
        description: item.description,
        category: item.category.name,
        typeId: item.typeId,
        typeCode: item.labelType?.code || null,
        typeName: item.labelType?.name || null,
        storageLocation: item.storageLocation?.name || null,
        storageArea: item.storageArea,
        bin: formatItemPosition(item) || item.bin,
        stock: serializeStoredQuantity(item.unit, item.stock),
        available: serializeStoredQuantity(item.unit, getAvailableQty(item.stock, reserved, item.placementStatus)),
        unit: item.unit,
        minStock: serializeStoredQuantity(item.unit, item.minStock),
        manufacturer: item.manufacturer,
        mpn: item.mpn,
        tags: item.tags.map((t) => t.tag.name).join("|")
      };
    }).filter((row) => (lowStockOnly ? row.minStock !== null && Number(row.available) <= Number(row.minStock) : true)),
    delimiter
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=inventory.csv"
    }
  });
}
