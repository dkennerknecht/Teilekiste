import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { backupRestoreSchema } from "@/lib/validation";
import { badRequest } from "@/lib/http";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get("file");
  const parsed = backupRestoreSchema.safeParse({ strategy: String(form.get("strategy") || "merge") });
  if (!parsed.success) return badRequest("Invalid restore strategy");
  const strategy = parsed.data.strategy;

  if (!(file instanceof File)) return badRequest("Backup ZIP fehlt");
  if (file.size > 500 * 1024 * 1024) return badRequest("Backup ZIP zu gross (max 500MB)");

  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = new AdmZip(buffer);
  const exportEntry = zip.getEntry("export.json");
  if (!exportEntry) return badRequest("export.json fehlt");
  let payload: any;
  try {
    payload = JSON.parse(exportEntry.getData().toString("utf8"));
  } catch {
    return badRequest("export.json ungueltig");
  }

  if (strategy === "overwrite") {
    await prisma.$transaction([
      prisma.favorite.deleteMany(),
      prisma.recentView.deleteMany(),
      prisma.itemTag.deleteMany(),
      prisma.itemCustomFieldValue.deleteMany(),
      prisma.reservation.deleteMany(),
      prisma.stockMovement.deleteMany(),
      prisma.itemImage.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.item.deleteMany(),
      prisma.customField.deleteMany(),
      prisma.tag.deleteMany(),
      prisma.category.deleteMany(),
      prisma.storageLocation.deleteMany()
    ]);
  }

  const conflicts = {
    categories: [] as string[],
    locations: [] as string[],
    tags: [] as string[],
    items: [] as string[]
  };

  for (const category of payload.categories || []) {
    const existing = await prisma.category.findFirst({
      where: { OR: [{ id: category.id }, { name: category.name }] }
    });
    if (existing && strategy === "merge" && existing.id !== category.id) {
      conflicts.categories.push(category.name);
      continue;
    }
    if (existing) {
      await prisma.category.update({ where: { id: existing.id }, data: { name: category.name } });
    } else {
      await prisma.category.create({ data: { id: category.id, name: category.name } });
    }
  }

  for (const location of payload.locations || []) {
    const existing = await prisma.storageLocation.findFirst({
      where: { OR: [{ id: location.id }, { name: location.name }] }
    });
    if (existing && strategy === "merge" && existing.id !== location.id) {
      conflicts.locations.push(location.name);
      continue;
    }
    if (existing) {
      await prisma.storageLocation.update({
        where: { id: existing.id },
        data: { name: location.name, code: location.code || null }
      });
    } else {
      await prisma.storageLocation.create({
        data: { id: location.id, name: location.name, code: location.code || null }
      });
    }
  }

  for (const tag of payload.tags || []) {
    const existing = await prisma.tag.findFirst({
      where: { OR: [{ id: tag.id }, { name: tag.name }] }
    });
    if (existing && strategy === "merge" && existing.id !== tag.id) {
      conflicts.tags.push(tag.name);
      continue;
    }
    if (existing) {
      await prisma.tag.update({ where: { id: existing.id }, data: { name: tag.name } });
    } else {
      await prisma.tag.create({ data: { id: tag.id, name: tag.name } });
    }
  }

  for (const field of payload.customFields || []) {
    await prisma.customField.upsert({
      where: { key: field.key },
      update: {
        name: field.name,
        type: field.type,
        options:
          field.options === null || field.options === undefined
            ? null
            : typeof field.options === "string"
            ? field.options
            : JSON.stringify(field.options),
        required: !!field.required,
        isActive: field.isActive !== false
      },
      create: {
        id: field.id,
        name: field.name,
        key: field.key,
        type: field.type,
        options:
          field.options === null || field.options === undefined
            ? null
            : typeof field.options === "string"
            ? field.options
            : JSON.stringify(field.options),
        required: !!field.required,
        isActive: field.isActive !== false
      }
    });
  }

  for (const item of payload.items || []) {
    const byLabel = await prisma.item.findUnique({ where: { labelCode: item.labelCode } });
    if (byLabel && byLabel.id !== item.id && strategy === "merge") {
      conflicts.items.push(item.labelCode);
      continue;
    }
    await prisma.item.upsert({
      where: { id: item.id },
      update: {
        labelCode: item.labelCode,
        name: item.name,
        description: item.description,
        categoryId: item.categoryId,
        storageLocationId: item.storageLocationId,
        storageArea: item.storageArea,
        bin: item.bin,
        stock: item.stock,
        unit: item.unit,
        minStock: item.minStock,
        manufacturer: item.manufacturer,
        mpn: item.mpn,
        datasheetUrl: item.datasheetUrl,
        purchaseUrl: item.purchaseUrl,
        barcodeEan: item.barcodeEan,
        isArchived: !!item.isArchived,
        deletedAt: item.deletedAt ? new Date(item.deletedAt) : null
      },
      create: {
        id: item.id,
        labelCode: item.labelCode,
        name: item.name,
        description: item.description,
        categoryId: item.categoryId,
        storageLocationId: item.storageLocationId,
        storageArea: item.storageArea,
        bin: item.bin,
        stock: item.stock,
        unit: item.unit,
        minStock: item.minStock,
        manufacturer: item.manufacturer,
        mpn: item.mpn,
        datasheetUrl: item.datasheetUrl,
        purchaseUrl: item.purchaseUrl,
        barcodeEan: item.barcodeEan,
        isArchived: !!item.isArchived,
        deletedAt: item.deletedAt ? new Date(item.deletedAt) : null
      }
    });

    if (item.tags?.length) {
      for (const tagRel of item.tags) {
        await prisma.itemTag
          .upsert({
            where: { itemId_tagId: { itemId: item.id, tagId: tagRel.tagId } },
            update: {},
            create: { itemId: item.id, tagId: tagRel.tagId }
          })
          .catch(() => null);
      }
    }

    if (item.customValues?.length) {
      for (const cv of item.customValues) {
        await prisma.itemCustomFieldValue
          .upsert({
            where: { itemId_customFieldId: { itemId: item.id, customFieldId: cv.customFieldId } },
            update: {
              valueJson: typeof cv.valueJson === "string" ? cv.valueJson : JSON.stringify(cv.valueJson)
            },
            create: {
              itemId: item.id,
              customFieldId: cv.customFieldId,
              valueJson: typeof cv.valueJson === "string" ? cv.valueJson : JSON.stringify(cv.valueJson)
            }
          })
          .catch(() => null);
      }
    }
  }

  const restoreTmp = "/tmp/restore";
  await fs.mkdir(restoreTmp, { recursive: true });
  zip.extractAllTo(restoreTmp, true);
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
  await fs.mkdir(env.ATTACHMENT_DIR, { recursive: true });
  await fs.cp(path.join(restoreTmp, "uploads"), env.UPLOAD_DIR, { recursive: true, force: true }).catch(() => null);
  await fs.cp(path.join(restoreTmp, "attachments"), env.ATTACHMENT_DIR, { recursive: true, force: true }).catch(() => null);

  return NextResponse.json({
    ok: true,
    strategy,
    restoredCategories: (payload.categories || []).length,
    restoredItems: (payload.items || []).length,
    conflicts
  });
}
