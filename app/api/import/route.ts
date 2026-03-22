import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assignNextLabelCode } from "@/lib/label-code";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get("file");
  const dryRun = String(form.get("dryRun") || "1") !== "0";
  const areaId = String(form.get("areaId") || "");
  const typeId = String(form.get("typeId") || "");

  if (!(file instanceof File)) return NextResponse.json({ error: "CSV file missing" }, { status: 400 });
  if (!dryRun && (!areaId || !typeId)) {
    return NextResponse.json({ error: "areaId and typeId required when dryRun=0" }, { status: 400 });
  }
  if (!dryRun) {
    const [area, type] = await Promise.all([
      prisma.area.findUnique({ where: { id: areaId } }),
      prisma.labelType.findUnique({ where: { id: typeId } })
    ]);
    if (!area || !type || type.areaId !== area.id) {
      return NextResponse.json({ error: "Invalid area/type combination" }, { status: 400 });
    }
  }
  const text = await file.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

  const errors: string[] = [];
  const preview: unknown[] = [];
  let created = 0;

  const categories = await prisma.category.findMany();
  const locations = await prisma.storageLocation.findMany();
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const locationMap = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]));

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  for (const [idx, row] of rows.entries()) {
    const categoryId = categoryMap.get((row.category || "").toLowerCase());
    const locationId = locationMap.get((row.storageLocation || "").toLowerCase());
    if (!categoryId || !locationId) {
      errors.push(`Zeile ${idx + 2}: Kategorie oder Lagerort unbekannt`);
      continue;
    }

    if (allowedLocationIds && !allowedLocationIds.includes(locationId)) {
      errors.push(`Zeile ${idx + 2}: Lagerort nicht erlaubt`);
      continue;
    }

    const input = {
      name: row.name,
      description: row.description || "",
      categoryId,
      storageLocationId: locationId,
      storageArea: row.storageArea || null,
      bin: row.bin || null,
      stock: Number(row.stock || 0),
      minStock: row.minStock ? Number(row.minStock) : null,
      unit: (row.unit || "STK") as "STK" | "M" | "SET" | "PACK",
      manufacturer: row.manufacturer || null,
      mpn: row.mpn || null,
      barcodeEan: row.barcodeEan || null
    };

    preview.push(input);

    if (!dryRun) {
      const labelCode = await assignNextLabelCode(areaId, typeId);
      await prisma.item.create({ data: { ...input, labelCode } });
      created += 1;
    }
  }

  return NextResponse.json({
    dryRun,
    totalRows: rows.length,
    created,
    errors,
    preview: preview.slice(0, 25)
  });
}
