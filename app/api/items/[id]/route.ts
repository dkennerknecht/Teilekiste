import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWriteAccess } from "@/lib/api";
import { itemUpdateSchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit";
import { summarizeAuditEntry } from "@/lib/audit-view";
import { assignNextLabelCode } from "@/lib/label-code";
import { loadItemBom } from "@/lib/item-bom";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { canSetStock, getAvailableQty, getReservedQty } from "@/lib/stock";
import { prepareCustomFieldValueWrites } from "@/lib/custom-fields";
import { parseJson } from "@/lib/http";

function safeParseAuditPayload(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const item = await prisma.item.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      storageLocation: true,
      tags: { include: { tag: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      attachments: true,
      movements: { orderBy: { createdAt: "desc" }, include: { user: true }, take: 30 },
      reservations: { orderBy: { createdAt: "desc" }, include: { user: true }, take: 30 },
      customValues: { include: { customField: true } }
    }
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ bomChildren, bomParents }, auditEntries, reservationHistoryEntries] = await Promise.all([
    loadItemBom(item.id, allowedLocationIds),
    auth.user!.role === "ADMIN"
      ? prisma.auditLog.findMany({
          where: {
            entity: "Item",
            entityId: item.id
          },
          include: {
            user: {
              select: { name: true, email: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 25
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: {
        entity: "Item",
        entityId: item.id,
        action: {
          in: ["RESERVATION_CREATE", "RESERVATION_DELETE"]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);

  await prisma.recentView.upsert({
    where: { userId_itemId: { userId: auth.user!.id, itemId: item.id } },
    update: { lastViewedAt: new Date() },
    create: { userId: auth.user!.id, itemId: item.id }
  });

  const reservedQty = getReservedQty(item.reservations);
  return NextResponse.json({
    ...item,
    bomChildren,
    bomParents,
    auditEntries: auditEntries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      createdAt: entry.createdAt,
      user: entry.user,
      summary: summarizeAuditEntry(entry)
    })),
    reservationHistoryEntries: reservationHistoryEntries.map((entry) => {
      const payload = safeParseAuditPayload(entry.after) || safeParseAuditPayload(entry.before);
      return {
        id: entry.id,
        action: entry.action,
        reservationId: payload?.reservationId || null,
        createdAt: entry.createdAt,
        text: summarizeAuditEntry(entry)
      };
    }),
    primaryImage: item.images[0] ?? null,
    reservedQty,
    availableStock: getAvailableQty(item.stock, reservedQty)
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, itemUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof itemUpdateSchema.parse>;

  const existing = await prisma.item.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const reservedQtyResult = await prisma.reservation.aggregate({
    where: { itemId: params.id },
    _sum: { reservedQty: true }
  });
  const reservedQty = reservedQtyResult._sum.reservedQty || 0;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(existing.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const targetLocationId = body.storageLocationId || existing.storageLocationId;
  if (allowedLocationIds && !allowedLocationIds.includes(targetLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (body.stock !== undefined && !canSetStock(body.stock, reservedQty)) {
    return NextResponse.json({ error: "Bestand darf nicht unter die reservierte Menge fallen" }, { status: 400 });
  }

  const {
    tagIds,
    customValues: _customValues,
    typeId: _typeId,
    categoryId,
    storageLocationId,
    ...itemData
  } = body;
  const nextCategoryId = body.categoryId || existing.categoryId;
  const nextTypeId = body.typeId || null;
  const shouldRegenerateLabel =
    !!nextTypeId && ((!!body.categoryId && body.categoryId !== existing.categoryId) || !!body.typeId);
  const labelCode = shouldRegenerateLabel ? await assignNextLabelCode(nextCategoryId, nextTypeId) : existing.labelCode;

  const item = await prisma.item.update({
    where: { id: params.id },
    data: {
      ...itemData,
      labelCode,
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
      ...(storageLocationId ? { storageLocation: { connect: { id: storageLocationId } } } : {}),
      storageArea: itemData.storageArea || undefined,
      bin: itemData.bin || undefined,
      minStock: itemData.minStock || undefined,
      manufacturer: itemData.manufacturer || null,
      mpn: itemData.mpn || null,
      ...(tagIds
        ? {
            tags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId }))
            }
          }
        : {})
    }
  });

  if (body.customValues) {
    const customFieldWrites = await prepareCustomFieldValueWrites(prisma, {
      rawValues: body.customValues,
      categoryId: nextCategoryId,
      typeId: nextTypeId
    });
    await Promise.all(
      customFieldWrites.upserts.map((entry) =>
        prisma.itemCustomFieldValue.upsert({
          where: { itemId_customFieldId: { itemId: item.id, customFieldId: entry.customFieldId } },
          update: { valueJson: entry.valueJson },
          create: { itemId: item.id, customFieldId: entry.customFieldId, valueJson: entry.valueJson }
        })
      )
    );
    if (customFieldWrites.deletions.length) {
      await prisma.itemCustomFieldValue.deleteMany({
        where: {
          itemId: item.id,
          customFieldId: { in: customFieldWrites.deletions }
        }
      });
    }
  }

  await auditLog({
    userId: auth.user!.id,
    action: "ITEM_UPDATE",
    entity: "Item",
    entityId: item.id,
    before: existing,
    after: item
  });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const existing = await prisma.item.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(existing.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await prisma.item.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await auditLog({
    userId: auth.user!.id,
    action: "ITEM_SOFT_DELETE",
    entity: "Item",
    entityId: item.id,
    before: existing,
    after: item
  });

  return NextResponse.json({ ok: true });
}
