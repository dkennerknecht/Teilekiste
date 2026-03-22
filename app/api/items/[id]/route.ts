import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWriteAccess } from "@/lib/api";
import { itemSchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit";
import { assignNextLabelCode } from "@/lib/label-code";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
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
  const auth = await requireWriteAccess();
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = itemSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.item.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(existing.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let labelCode = existing.labelCode;
  const config = await prisma.labelConfig.findUnique({ where: { id: "default" } });
  const hasManualCode = !!parsed.data.labelCode && auth.user!.role === "ADMIN" && config?.allowCodeEdit;
  if (hasManualCode) {
    labelCode = parsed.data.labelCode!;
  }
  if (!hasManualCode && parsed.data.areaId && parsed.data.typeId) {
    if (config?.regenerateOnType) {
      labelCode = await assignNextLabelCode(parsed.data.areaId, parsed.data.typeId);
    }
  }

  const { tagIds, ...itemData } = parsed.data;

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

  if (parsed.data.customValues) {
    await Promise.all(
      Object.entries(parsed.data.customValues).map(([fieldId, value]) =>
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

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess();
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
