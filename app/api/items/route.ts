import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWriteAccess } from "@/lib/api";
import { buildItemFilter } from "@/lib/query";
import { itemSchema } from "@/lib/validation";
import { assignNextLabelCode } from "@/lib/label-code";
import { auditLog } from "@/lib/audit";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { parseJson, parsePagination, serverError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const where = buildItemFilter(req.nextUrl.searchParams, allowedLocationIds);
  const { limit, offset } = parsePagination(req.nextUrl.searchParams, 200);

  const sort = req.nextUrl.searchParams.get("sort") || "labelCode";
  const orderBy =
    sort === "name"
      ? { name: "asc" as const }
      : sort === "stock"
      ? { stock: "asc" as const }
      : sort === "updatedAt"
      ? { updatedAt: "desc" as const }
      : { labelCode: "asc" as const };

  const items = await prisma.item.findMany({
    where,
    include: {
      category: true,
      storageLocation: true,
      tags: { include: { tag: true } },
      _count: { select: { images: true, attachments: true, reservations: true } },
      reservations: { select: { reservedQty: true } },
      images: {
        select: { path: true, thumbPath: true, caption: true, isPrimary: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1
      }
    },
    orderBy,
    take: limit,
    skip: offset
  });
  const total = await prisma.item.count({ where });

  const lowStock = req.nextUrl.searchParams.get("lowStock") === "1";
  const shaped = items
    .map((item) => ({
      ...item,
      primaryImage: item.images[0] ?? null,
      reservedQty: item.reservations.reduce((sum, r) => sum + r.reservedQty, 0),
      availableStock: item.stock - item.reservations.reduce((sum, r) => sum + r.reservedQty, 0)
    }))
    .filter((item) => (lowStock ? item.minStock !== null && item.stock <= item.minStock : true));

  return NextResponse.json({ items: shaped, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsedBody = await parseJson<unknown>(req, itemSchema);
  if ("error" in parsedBody) return parsedBody.error;
  const parsed = { data: parsedBody.data as ReturnType<typeof itemSchema.parse> };

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(parsed.data.storageLocationId)) {
    return NextResponse.json({ error: "Storage location not allowed" }, { status: 403 });
  }

  let attempts = 0;
  while (attempts < 3) {
    attempts += 1;
    try {
      const item = await prisma.$transaction(async (tx) => {
        const labelCode = await assignNextLabelCode(parsed.data.areaId, parsed.data.typeId, tx);

        const createdItem = await tx.item.create({
          data: {
            labelCode,
            name: parsed.data.name,
            description: parsed.data.description,
            categoryId: parsed.data.categoryId,
            storageLocationId: parsed.data.storageLocationId,
            storageArea: parsed.data.storageArea || null,
            bin: parsed.data.bin || null,
            stock: parsed.data.stock,
            unit: parsed.data.unit,
            minStock: parsed.data.minStock || null,
            manufacturer: parsed.data.manufacturer || null,
            mpn: parsed.data.mpn || null,
            datasheetUrl: parsed.data.datasheetUrl || null,
            purchaseUrl: parsed.data.purchaseUrl || null,
            barcodeEan: parsed.data.barcodeEan || null,
            tags: {
              create: parsed.data.tagIds.map((tagId) => ({ tagId }))
            }
          }
        });

        await Promise.all(
          Object.entries(parsed.data.customValues || {}).map(([fieldId, value]) =>
            tx.itemCustomFieldValue.upsert({
              where: { itemId_customFieldId: { itemId: createdItem.id, customFieldId: fieldId } },
              update: { valueJson: JSON.stringify(value) },
              create: { itemId: createdItem.id, customFieldId: fieldId, valueJson: JSON.stringify(value) }
            })
          )
        );

        await tx.stockMovement.create({
          data: {
            itemId: createdItem.id,
            delta: parsed.data.stock,
            reason: "PURCHASE",
            note: "Initial stock",
            userId: auth.user!.id
          }
        });

        await auditLog(
          {
            userId: auth.user!.id,
            action: "ITEM_CREATE",
            entity: "Item",
            entityId: createdItem.id,
            after: createdItem
          },
          tx
        );

        return createdItem;
      });

      return NextResponse.json(item, { status: 201 });
    } catch (error) {
      if (attempts >= 3) {
        return serverError(`Create failed: ${(error as Error).message}`);
      }
    }
  }

  return serverError("Create failed");
}
