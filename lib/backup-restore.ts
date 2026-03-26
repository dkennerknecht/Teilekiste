import path from "node:path";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type RestoreStrategy = "merge" | "overwrite";

type BackupUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  passwordHash?: string | null;
};

type BackupCategory = {
  id: string;
  name: string;
};

type BackupLocation = {
  id: string;
  name: string;
  code?: string | null;
};

type BackupTag = {
  id: string;
  name: string;
};

type BackupCustomField = {
  id: string;
  name: string;
  key: string;
  type: string;
  options?: unknown;
  required?: boolean;
  isActive?: boolean;
  categoryId?: string | null;
};

type BackupItemTag = {
  tagId: string;
};

type BackupCustomValue = {
  customFieldId: string;
  valueJson: unknown;
};

type BackupItemImage = {
  id: string;
  path: string;
  thumbPath?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
  mime: string;
  size: number;
  caption?: string | null;
  createdAt?: string | null;
};

type BackupAttachment = {
  id: string;
  path: string;
  mime: string;
  size: number;
  kind: string;
  createdAt?: string | null;
};

type BackupStockMovement = {
  id: string;
  delta: number;
  reason: string;
  note?: string | null;
  userId: string;
  createdAt?: string | null;
};

type BackupReservation = {
  id: string;
  reservedQty: number;
  reservedFor: string;
  note?: string | null;
  userId: string;
  createdAt?: string | null;
};

type BackupItem = {
  id: string;
  labelCode: string;
  name: string;
  description: string;
  categoryId: string;
  storageLocationId: string;
  storageArea?: string | null;
  bin?: string | null;
  stock: number;
  unit: string;
  minStock?: number | null;
  manufacturer?: string | null;
  mpn?: string | null;
  datasheetUrl?: string | null;
  purchaseUrl?: string | null;
  barcodeEan?: string | null;
  isArchived?: boolean;
  deletedAt?: string | null;
  tags?: BackupItemTag[];
  customValues?: BackupCustomValue[];
  images?: BackupItemImage[];
  attachments?: BackupAttachment[];
  movements?: BackupStockMovement[];
  reservations?: BackupReservation[];
};

export type BackupPayload = {
  users?: BackupUser[];
  categories?: BackupCategory[];
  locations?: BackupLocation[];
  tags?: BackupTag[];
  customFields?: BackupCustomField[];
  items?: BackupItem[];
};

export type RestoreResult = {
  conflicts: {
    categories: string[];
    locations: string[];
    tags: string[];
    items: string[];
  };
  restoredCategories: number;
  restoredItems: number;
  restoredUsers: number;
  placeholderUsers: number;
};

function serializeOptions(options: unknown) {
  if (options === null || options === undefined) return null;
  return typeof options === "string" ? options : JSON.stringify(options);
}

function parseDate(value?: string | null) {
  return value ? new Date(value) : undefined;
}

function remapStoredPath(storedPath: string | null | undefined, marker: "uploads" | "attachments") {
  if (!storedPath) return null;

  const root = marker === "uploads" ? env.UPLOAD_DIR : env.ATTACHMENT_DIR;
  const normalizedPath = storedPath.replace(/\\/g, "/");
  const normalizedRoot = root.replace(/\\/g, "/");

  if (normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return storedPath;
  }

  const needle = `/${marker}/`;
  const markerIndex = normalizedPath.lastIndexOf(needle);
  if (markerIndex === -1) return storedPath;

  const relativePath = normalizedPath.slice(markerIndex + needle.length);
  return path.join(root, ...relativePath.split("/").filter(Boolean));
}

async function resolveUserIds(payloadUsers: BackupUser[] | undefined, strategy: RestoreStrategy) {
  const userIdMap = new Map<string, string>();
  let restoredUsers = 0;
  let placeholderUsers = 0;
  let placeholderPasswordHash: string | null = null;

  for (const user of payloadUsers || []) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: user.id }, { email: user.email }] }
    });

    if (existing) {
      userIdMap.set(user.id, existing.id);
      if (existing.id === user.id || strategy === "overwrite") {
        const data = {
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          ...(user.passwordHash ? { passwordHash: user.passwordHash } : {})
        };
        await prisma.user.update({ where: { id: existing.id }, data });
      }
      continue;
    }

    if (!placeholderPasswordHash) {
      placeholderPasswordHash = await bcrypt.hash(randomUUID(), 10);
    }

    const created = await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.passwordHash ? user.isActive : false,
        passwordHash: user.passwordHash || placeholderPasswordHash
      }
    });

    userIdMap.set(user.id, created.id);
    restoredUsers += 1;
    if (!user.passwordHash) placeholderUsers += 1;
  }

  return { userIdMap, restoredUsers, placeholderUsers };
}

export async function restoreBackupData(input: {
  payload: BackupPayload;
  strategy: RestoreStrategy;
  fallbackUserId: string;
}) {
  const { payload, strategy, fallbackUserId } = input;
  const conflicts = {
    categories: [] as string[],
    locations: [] as string[],
    tags: [] as string[],
    items: [] as string[]
  };

  const { userIdMap, restoredUsers, placeholderUsers } = await resolveUserIds(payload.users, strategy);
  const categoryIdMap = new Map<string, string>();
  const locationIdMap = new Map<string, string>();
  const tagIdMap = new Map<string, string>();
  const customFieldIdMap = new Map<string, string>();

  for (const category of payload.categories || []) {
    const existing = await prisma.category.findFirst({
      where: { OR: [{ id: category.id }, { name: category.name }] }
    });

    if (existing) {
      categoryIdMap.set(category.id, existing.id);
      if (strategy === "merge" && existing.id !== category.id) {
        conflicts.categories.push(category.name);
        continue;
      }
      await prisma.category.update({ where: { id: existing.id }, data: { name: category.name } });
      continue;
    }

    const created = await prisma.category.create({ data: { id: category.id, name: category.name } });
    categoryIdMap.set(category.id, created.id);
  }

  for (const location of payload.locations || []) {
    const existing = await prisma.storageLocation.findFirst({
      where: { OR: [{ id: location.id }, { name: location.name }] }
    });

    if (existing) {
      locationIdMap.set(location.id, existing.id);
      if (strategy === "merge" && existing.id !== location.id) {
        conflicts.locations.push(location.name);
        continue;
      }
      await prisma.storageLocation.update({
        where: { id: existing.id },
        data: { name: location.name, code: location.code || null }
      });
      continue;
    }

    const created = await prisma.storageLocation.create({
      data: { id: location.id, name: location.name, code: location.code || null }
    });
    locationIdMap.set(location.id, created.id);
  }

  for (const tag of payload.tags || []) {
    const existing = await prisma.tag.findFirst({
      where: { OR: [{ id: tag.id }, { name: tag.name }] }
    });

    if (existing) {
      tagIdMap.set(tag.id, existing.id);
      if (strategy === "merge" && existing.id !== tag.id) {
        conflicts.tags.push(tag.name);
        continue;
      }
      await prisma.tag.update({ where: { id: existing.id }, data: { name: tag.name } });
      continue;
    }

    const created = await prisma.tag.create({ data: { id: tag.id, name: tag.name } });
    tagIdMap.set(tag.id, created.id);
  }

  for (const field of payload.customFields || []) {
    const restoredField = await prisma.customField.upsert({
      where: { key: field.key },
      update: {
        name: field.name,
        type: field.type,
        options: serializeOptions(field.options),
        required: !!field.required,
        isActive: field.isActive !== false,
        categoryId: field.categoryId ? categoryIdMap.get(field.categoryId) || field.categoryId : null
      },
      create: {
        id: field.id,
        name: field.name,
        key: field.key,
        type: field.type,
        options: serializeOptions(field.options),
        required: !!field.required,
        isActive: field.isActive !== false,
        categoryId: field.categoryId ? categoryIdMap.get(field.categoryId) || field.categoryId : null
      }
    });
    customFieldIdMap.set(field.id, restoredField.id);
  }

  for (const item of payload.items || []) {
    const resolvedCategoryId = categoryIdMap.get(item.categoryId) || item.categoryId;
    const resolvedLocationId = locationIdMap.get(item.storageLocationId) || item.storageLocationId;
    const byLabel = await prisma.item.findUnique({ where: { labelCode: item.labelCode } });

    if (byLabel && byLabel.id !== item.id && strategy === "merge") {
      conflicts.items.push(item.labelCode);
      continue;
    }

    let restoredItem: { id: string } | null = null;
    try {
      restoredItem = await prisma.item.upsert({
        where: { id: item.id },
        update: {
          labelCode: item.labelCode,
          name: item.name,
          description: item.description,
          categoryId: resolvedCategoryId,
          storageLocationId: resolvedLocationId,
          storageArea: item.storageArea || null,
          bin: item.bin || null,
          stock: item.stock,
          unit: item.unit,
          minStock: item.minStock ?? null,
          manufacturer: item.manufacturer || null,
          mpn: item.mpn || null,
          datasheetUrl: item.datasheetUrl || null,
          purchaseUrl: item.purchaseUrl || null,
          barcodeEan: item.barcodeEan || null,
          isArchived: !!item.isArchived,
          deletedAt: item.deletedAt ? new Date(item.deletedAt) : null
        },
        create: {
          id: item.id,
          labelCode: item.labelCode,
          name: item.name,
          description: item.description,
          categoryId: resolvedCategoryId,
          storageLocationId: resolvedLocationId,
          storageArea: item.storageArea || null,
          bin: item.bin || null,
          stock: item.stock,
          unit: item.unit,
          minStock: item.minStock ?? null,
          manufacturer: item.manufacturer || null,
          mpn: item.mpn || null,
          datasheetUrl: item.datasheetUrl || null,
          purchaseUrl: item.purchaseUrl || null,
          barcodeEan: item.barcodeEan || null,
          isArchived: !!item.isArchived,
          deletedAt: item.deletedAt ? new Date(item.deletedAt) : null
        }
      });
    } catch {
      conflicts.items.push(item.labelCode);
      continue;
    }

    for (const tagRel of item.tags || []) {
      const resolvedTagId = tagIdMap.get(tagRel.tagId) || tagRel.tagId;
      await prisma.itemTag
        .upsert({
          where: { itemId_tagId: { itemId: restoredItem.id, tagId: resolvedTagId } },
          update: {},
          create: { itemId: restoredItem.id, tagId: resolvedTagId }
        })
        .catch(() => null);
    }

    for (const cv of item.customValues || []) {
      const resolvedFieldId = customFieldIdMap.get(cv.customFieldId) || cv.customFieldId;
      await prisma.itemCustomFieldValue
        .upsert({
          where: { itemId_customFieldId: { itemId: restoredItem.id, customFieldId: resolvedFieldId } },
          update: {
            valueJson: typeof cv.valueJson === "string" ? cv.valueJson : JSON.stringify(cv.valueJson)
          },
          create: {
            itemId: restoredItem.id,
            customFieldId: resolvedFieldId,
            valueJson: typeof cv.valueJson === "string" ? cv.valueJson : JSON.stringify(cv.valueJson)
          }
        })
        .catch(() => null);
    }

    for (const image of item.images || []) {
      const pathValue = remapStoredPath(image.path, "uploads") || image.path;
      const thumbPath = remapStoredPath(image.thumbPath || null, "uploads");
      await prisma.itemImage.upsert({
        where: { id: image.id },
        update: {
          itemId: restoredItem.id,
          path: pathValue,
          thumbPath,
          isPrimary: !!image.isPrimary,
          sortOrder: image.sortOrder ?? 0,
          mime: image.mime,
          size: image.size,
          caption: image.caption || null
        },
        create: {
          id: image.id,
          itemId: restoredItem.id,
          path: pathValue,
          thumbPath,
          isPrimary: !!image.isPrimary,
          sortOrder: image.sortOrder ?? 0,
          mime: image.mime,
          size: image.size,
          caption: image.caption || null,
          ...(parseDate(image.createdAt) ? { createdAt: parseDate(image.createdAt) } : {})
        }
      });
    }

    for (const attachment of item.attachments || []) {
      const pathValue = remapStoredPath(attachment.path, "attachments") || attachment.path;
      await prisma.attachment.upsert({
        where: { id: attachment.id },
        update: {
          itemId: restoredItem.id,
          path: pathValue,
          mime: attachment.mime,
          size: attachment.size,
          kind: attachment.kind
        },
        create: {
          id: attachment.id,
          itemId: restoredItem.id,
          path: pathValue,
          mime: attachment.mime,
          size: attachment.size,
          kind: attachment.kind,
          ...(parseDate(attachment.createdAt) ? { createdAt: parseDate(attachment.createdAt) } : {})
        }
      });
    }

    for (const movement of item.movements || []) {
      const resolvedUserId = userIdMap.get(movement.userId) || fallbackUserId;
      await prisma.stockMovement.upsert({
        where: { id: movement.id },
        update: {
          itemId: restoredItem.id,
          delta: movement.delta,
          reason: movement.reason,
          note: movement.note || null,
          userId: resolvedUserId
        },
        create: {
          id: movement.id,
          itemId: restoredItem.id,
          delta: movement.delta,
          reason: movement.reason,
          note: movement.note || null,
          userId: resolvedUserId,
          ...(parseDate(movement.createdAt) ? { createdAt: parseDate(movement.createdAt) } : {})
        }
      });
    }

    for (const reservation of item.reservations || []) {
      const resolvedUserId = userIdMap.get(reservation.userId) || fallbackUserId;
      await prisma.reservation.upsert({
        where: { id: reservation.id },
        update: {
          itemId: restoredItem.id,
          reservedQty: reservation.reservedQty,
          reservedFor: reservation.reservedFor,
          note: reservation.note || null,
          userId: resolvedUserId
        },
        create: {
          id: reservation.id,
          itemId: restoredItem.id,
          reservedQty: reservation.reservedQty,
          reservedFor: reservation.reservedFor,
          note: reservation.note || null,
          userId: resolvedUserId,
          ...(parseDate(reservation.createdAt) ? { createdAt: parseDate(reservation.createdAt) } : {})
        }
      });
    }
  }

  return {
    conflicts,
    restoredCategories: (payload.categories || []).length,
    restoredItems: (payload.items || []).length,
    restoredUsers,
    placeholderUsers
  } satisfies RestoreResult;
}
