import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { bomEntrySchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";
import { auditLog } from "@/lib/audit";
import { loadItemBom } from "@/lib/item-bom";

async function getScopedItem(itemId: string, user: { id: string; role: string }) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, deletedAt: null },
    select: {
      id: true,
      labelCode: true,
      name: true,
      storageLocationId: true
    }
  });
  if (!item) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const allowedLocationIds = await resolveAllowedLocationIds(user as never);
  if (item.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { item, allowedLocationIds };
}

async function createsBomCycle(parentItemId: string, childItemId: string) {
  const visited = new Set<string>();
  const queue = [childItemId];

  while (queue.length) {
    const currentId = queue.shift()!;
    if (currentId === parentItemId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const children = await prisma.billOfMaterial.findMany({
      where: { parentItemId: currentId },
      select: { childItemId: true }
    });
    for (const child of children) {
      if (!visited.has(child.childItemId)) {
        queue.push(child.childItemId);
      }
    }
  }

  return false;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const access = await getScopedItem(params.id, auth.user!);
  if (access.error) return access.error;

  return NextResponse.json(await loadItemBom(params.id, access.allowedLocationIds || null));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const access = await getScopedItem(params.id, auth.user!);
  if (access.error) return access.error;

  const parsed = await parseJson<unknown>(req, bomEntrySchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof bomEntrySchema.parse>;

  if (body.childItemId === params.id) {
    return NextResponse.json({ error: "Ein Item kann nicht Teil seiner eigenen Stückliste sein" }, { status: 400 });
  }

  const childItem = await prisma.item.findFirst({
    where: { id: body.childItemId, deletedAt: null },
    select: {
      id: true,
      labelCode: true,
      name: true,
      storageLocationId: true
    }
  });
  if (!childItem) return NextResponse.json({ error: "Komponente nicht gefunden" }, { status: 404 });

  if (childItem.storageLocationId && access.allowedLocationIds && !access.allowedLocationIds.includes(childItem.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (await createsBomCycle(params.id, childItem.id)) {
    return NextResponse.json({ error: "Zyklische Stücklisten sind nicht erlaubt" }, { status: 400 });
  }

  const existing = await prisma.billOfMaterial.findUnique({
    where: {
      parentItemId_childItemId: {
        parentItemId: params.id,
        childItemId: body.childItemId
      }
    }
  });

  const entry = await prisma.billOfMaterial.upsert({
    where: {
      parentItemId_childItemId: {
        parentItemId: params.id,
        childItemId: body.childItemId
      }
    },
    update: { qty: body.qty },
    create: {
      parentItemId: params.id,
      childItemId: body.childItemId,
      qty: body.qty
    }
  });

  await auditLog({
    userId: auth.user!.id,
    action: "BOM_UPSERT",
    entity: "Item",
    entityId: params.id,
    before: existing
      ? {
          childItemId: existing.childItemId,
          qty: existing.qty,
          childLabelCode: childItem.labelCode
        }
      : null,
    after: {
      childItemId: childItem.id,
      qty: entry.qty,
      childLabelCode: childItem.labelCode
    }
  });

  return NextResponse.json(entry, { status: existing ? 200 : 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const access = await getScopedItem(params.id, auth.user!);
  if (access.error) return access.error;

  const parsed = await parseJson<unknown>(req, bomEntrySchema.pick({ childItemId: true }));
  if ("error" in parsed) return parsed.error;
  const { childItemId } = parsed.data as { childItemId: string };

  const existing = await prisma.billOfMaterial.findUnique({
    where: {
      parentItemId_childItemId: {
        parentItemId: params.id,
        childItemId
      }
    }
  });
  if (!existing) return NextResponse.json({ error: "Stücklisten-Eintrag nicht gefunden" }, { status: 404 });

  const childItem = await prisma.item.findFirst({
    where: { id: childItemId, deletedAt: null },
    select: {
      id: true,
      labelCode: true,
      storageLocationId: true
    }
  });
  if (!childItem) return NextResponse.json({ error: "Komponente nicht gefunden" }, { status: 404 });

  if (childItem.storageLocationId && access.allowedLocationIds && !access.allowedLocationIds.includes(childItem.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.billOfMaterial.delete({
    where: {
      parentItemId_childItemId: {
        parentItemId: params.id,
        childItemId
      }
    }
  });

  await auditLog({
    userId: auth.user!.id,
    action: "BOM_REMOVE",
    entity: "Item",
    entityId: params.id,
    before: {
      childItemId,
      qty: existing.qty,
      childLabelCode: childItem.labelCode
    }
  });

  return NextResponse.json({ ok: true });
}
