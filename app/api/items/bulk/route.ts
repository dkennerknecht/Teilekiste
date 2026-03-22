import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assignNextLabelCode, previewBulkLabelCodes } from "@/lib/label-code";
import { resolveAllowedLocationIds } from "@/lib/permissions";

type BulkBody = {
  itemIds: string[];
  categoryId?: string;
  storageLocationId?: string;
  storageArea?: string | null;
  bin?: string | null;
  minStock?: number | null;
  unit?: "STK" | "M" | "SET" | "PACK";
  addTagIds?: string[];
  removeTagIds?: string[];
  areaId?: string;
  typeId?: string;
  dryRun?: boolean;
};

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess();
  if (auth.error) return auth.error;

  const body = (await req.json()) as BulkBody;
  const itemIds = body.itemIds || [];
  if (!itemIds.length) return NextResponse.json({ error: "No itemIds" }, { status: 400 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });

  if (allowedLocationIds) {
    const forbidden = items.some((item) => !allowedLocationIds.includes(item.storageLocationId));
    if (forbidden) return NextResponse.json({ error: "Forbidden by storage scope" }, { status: 403 });
    if (body.storageLocationId && !allowedLocationIds.includes(body.storageLocationId)) {
      return NextResponse.json({ error: "Target location not allowed" }, { status: 403 });
    }
  }

  const previewCodes: Array<{ itemId: string; oldCode: string; newCode: string }> = [];

  if (body.areaId && body.typeId) {
    const preview = await previewBulkLabelCodes(body.areaId, body.typeId, items.length);
    for (let idx = 0; idx < items.length; idx += 1) {
      previewCodes.push({ itemId: items[idx].id, oldCode: items[idx].labelCode, newCode: preview[idx] });
    }
  }

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      count: items.length,
      previewCodes
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const codeRow = previewCodes.find((row) => row.itemId === item.id);
      let labelCode: string | undefined;
      if (codeRow && body.areaId && body.typeId) {
        labelCode = await assignNextLabelCode(body.areaId, body.typeId);
      }
      await tx.item.update({
        where: { id: item.id },
        data: {
          categoryId: body.categoryId || undefined,
          storageLocationId: body.storageLocationId || undefined,
          storageArea: body.storageArea !== undefined ? body.storageArea : undefined,
          bin: body.bin !== undefined ? body.bin : undefined,
          minStock: body.minStock !== undefined ? body.minStock : undefined,
          unit: body.unit || undefined,
          labelCode
        }
      });

      if (body.addTagIds?.length) {
        for (const tagId of body.addTagIds) {
          await tx.itemTag.upsert({
            where: { itemId_tagId: { itemId: item.id, tagId } },
            update: {},
            create: { itemId: item.id, tagId }
          });
        }
      }

      if (body.removeTagIds?.length) {
        await tx.itemTag.deleteMany({ where: { itemId: item.id, tagId: { in: body.removeTagIds } } });
      }
    }
  });

  return NextResponse.json({ dryRun: false, count: items.length, previewCodes });
}
