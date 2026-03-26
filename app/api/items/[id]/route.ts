import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWriteAccess } from "@/lib/api";
import { itemUpdateSchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit";
import { assignNextLabelCode } from "@/lib/label-code";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { parseJson } from "@/lib/http";

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

  await prisma.recentView.upsert({
    where: { userId_itemId: { userId: auth.user!.id, itemId: item.id } },
    update: { lastViewedAt: new Date() },
    create: { userId: auth.user!.id, itemId: item.id }
  });

  const reservedQty = item.reservations.reduce((sum, r) => sum + r.reservedQty, 0);
  return NextResponse.json({
    ...item,
    primaryImage: item.images[0] ?? null,
    reservedQty,
    availableStock: item.stock - reservedQty
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

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(existing.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const targetLocationId = body.storageLocationId || existing.storageLocationId;
  if (allowedLocationIds && !allowedLocationIds.includes(targetLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let labelCode = existing.labelCode;
  const config = await prisma.labelConfig.findUnique({ where: { id: "default" } });
  const hasManualCode = !!body.labelCode && auth.user!.role === "ADMIN" && config?.allowCodeEdit;
  if (hasManualCode) {
    labelCode = body.labelCode!;
  }
  if (!hasManualCode && body.areaId && body.typeId) {
    if (config?.regenerateOnType) {
      labelCode = await assignNextLabelCode(body.areaId, body.typeId);
    }
  }

  const { tagIds, ...itemData } = body;

  const item = await prisma.item.update({
    where: { id: params.id },
    data: {
      ...itemData,
      labelCode,
      storageArea: itemData.storageArea || undefined,
      bin: itemData.bin || undefined,
      minStock: itemData.minStock || undefined,
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
    await Promise.all(
      Object.entries(body.customValues).map(([fieldId, value]) =>
        prisma.itemCustomFieldValue.upsert({
          where: { itemId_customFieldId: { itemId: item.id, customFieldId: fieldId } },
          update: { valueJson: JSON.stringify(value) },
          create: { itemId: item.id, customFieldId: fieldId, valueJson: JSON.stringify(value) }
        })
      )
    );
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
