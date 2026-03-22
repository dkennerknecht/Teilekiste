import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      storageLocationId: allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined
    },
    include: { category: true, storageLocation: true, tags: { include: { tag: true } }, reservations: true }
  });

  const delimiter = req.nextUrl.searchParams.get("delimiter") || ",";
  const lowStockOnly = req.nextUrl.searchParams.get("lowStock") === "1";
  const csv = toCsv(
    items.map((item) => {
      const reserved = item.reservations.reduce((sum, r) => sum + r.reservedQty, 0);
      return {
        id: item.id,
        labelCode: item.labelCode,
        name: item.name,
        description: item.description,
        category: item.category.name,
        storageLocation: item.storageLocation.name,
        storageArea: item.storageArea,
        bin: item.bin,
        stock: item.stock,
        available: item.stock - reserved,
        unit: item.unit,
        minStock: item.minStock,
        manufacturer: item.manufacturer,
        mpn: item.mpn,
        barcodeEan: item.barcodeEan,
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
