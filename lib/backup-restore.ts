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
  allowedLocationIds?: string[];
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

type BackupShelf = {
  id: string;
  name: string;
  storageLocationId: string;
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
  unit?: string | null;
  options?: unknown;
  valueCatalog?: unknown;
  sortOrder?: number;
  required?: boolean;
  isActive?: boolean;
  categoryId?: string | null;
  typeId?: string | null;
};

type BackupArea = {
  id: string;
  code: string;
  name: string;
  active?: boolean;
};

type BackupLabelType = {
  id: string;
  areaId: string;
  code: string;
  name: string;
  active?: boolean;
};

type BackupSequenceCounter = {
  id: string;
  areaId: string;
  typeId: string;
  nextNumber: number;
};

type BackupLabelConfig = {
  id?: string;
  language?: string;
  separator?: string;
  digits?: number;
  prefix?: string | null;
  suffix?: string | null;
  recycleNumbers?: boolean;
  delimiter?: string;
  allowCodeEdit?: boolean;
  regenerateOnType?: boolean;
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
  isArchived?: boolean;
  deletedAt?: string | null;
  tags?: BackupItemTag[];
  customValues?: BackupCustomValue[];
  images?: BackupItemImage[];
  attachments?: BackupAttachment[];
  movements?: BackupStockMovement[];
  reservations?: BackupReservation[];
};

type BackupBom = {
  parentItemId: string;
  childItemId: string;
  qty: number;
};

type BackupAuditLog = {
  id: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  createdAt?: string | null;
};

export type BackupPayload = {
  users?: BackupUser[];
  categories?: BackupCategory[];
  locations?: BackupLocation[];
  shelves?: BackupShelf[];
  tags?: BackupTag[];
  customFields?: BackupCustomField[];
  areas?: BackupArea[];
  types?: BackupLabelType[];
  sequenceCounters?: BackupSequenceCounter[];
  labelConfig?: BackupLabelConfig | null;
  items?: BackupItem[];
  boms?: BackupBom[];
  auditLogs?: BackupAuditLog[];
};

export type RestoreResult = {
  conflicts: {
    categories: string[];
    locations: string[];
    shelves: string[];
    tags: string[];
    items: string[];
    areas: string[];
    types: string[];
  };
  restoredCategories: number;
  restoredLocations: number;
  restoredShelves: number;
  restoredTags: number;
  restoredAreas: number;
  restoredTypes: number;
  restoredSequenceCounters: number;
  restoredItems: number;
  restoredBomEntries: number;
  restoredAuditLogs: number;
  restoredUsers: number;
  restoredUserScopes: number;
  placeholderUsers: number;
};

function serializeOptions(options: unknown) {
  if (options === null || options === undefined) return null;
  return typeof options === "string" ? options : JSON.stringify(options);
}

function serializeJsonValue(value: unknown) {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
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
    shelves: [] as string[],
    tags: [] as string[],
    items: [] as string[],
    areas: [] as string[],
    types: [] as string[]
  };

  const { userIdMap, restoredUsers, placeholderUsers } = await resolveUserIds(payload.users, strategy);
  const categoryIdMap = new Map<string, string>();
  const locationIdMap = new Map<string, string>();
  const tagIdMap = new Map<string, string>();
  const customFieldIdMap = new Map<string, string>();
  const areaIdMap = new Map<string, string>();
  const typeIdMap = new Map<string, string>();

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

  for (const shelf of payload.shelves || []) {
    const resolvedLocationId = locationIdMap.get(shelf.storageLocationId) || shelf.storageLocationId;
    const existing = await prisma.storageShelf.findFirst({
      where: {
        OR: [{ id: shelf.id }, { storageLocationId: resolvedLocationId, name: shelf.name }]
      }
    });

    if (existing) {
      if (strategy === "merge" && existing.id !== shelf.id) {
        conflicts.shelves.push(`${shelf.name} (${resolvedLocationId})`);
        continue;
      }
      await prisma.storageShelf.update({
        where: { id: existing.id },
        data: { name: shelf.name, storageLocationId: resolvedLocationId }
      });
      continue;
    }

    const created = await prisma.storageShelf.create({
      data: { id: shelf.id, name: shelf.name, storageLocationId: resolvedLocationId }
    });
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

  for (const area of payload.areas || []) {
    const existing = await prisma.area.findFirst({
      where: { OR: [{ id: area.id }, { code: area.code }] }
    });

    if (existing) {
      areaIdMap.set(area.id, existing.id);
      if (strategy === "merge" && existing.id !== area.id) {
        conflicts.areas.push(area.code);
        continue;
      }
      await prisma.area.update({
        where: { id: existing.id },
        data: {
          code: area.code,
          name: area.name,
          active: area.active !== false
        }
      });
      continue;
    }

    const created = await prisma.area.create({
      data: {
        id: area.id,
        code: area.code,
        name: area.name,
        active: area.active !== false
      }
    });
    areaIdMap.set(area.id, created.id);
  }

  for (const type of payload.types || []) {
    const resolvedAreaId = areaIdMap.get(type.areaId) || type.areaId;
    const existing = await prisma.labelType.findFirst({
      where: {
        OR: [
          { id: type.id },
          { areaId: resolvedAreaId, code: type.code }
        ]
      }
    });

    if (existing) {
      typeIdMap.set(type.id, existing.id);
      if (strategy === "merge" && existing.id !== type.id) {
        conflicts.types.push(`${type.code} (${resolvedAreaId})`);
        continue;
      }
      await prisma.labelType.update({
        where: { id: existing.id },
        data: {
          areaId: resolvedAreaId,
          code: type.code,
          name: type.name,
          active: type.active !== false
        }
      });
      continue;
    }

    const created = await prisma.labelType.create({
      data: {
        id: type.id,
        areaId: resolvedAreaId,
        code: type.code,
        name: type.name,
        active: type.active !== false
      }
    });
    typeIdMap.set(type.id, created.id);
  }

  if (payload.labelConfig) {
    await prisma.labelConfig.upsert({
      where: { id: payload.labelConfig.id || "default" },
      update: {
        language: payload.labelConfig.language ?? undefined,
        separator: payload.labelConfig.separator ?? undefined,
        digits: payload.labelConfig.digits ?? undefined,
        prefix: payload.labelConfig.prefix ?? null,
        suffix: payload.labelConfig.suffix ?? null,
        recycleNumbers: payload.labelConfig.recycleNumbers ?? undefined,
        delimiter: payload.labelConfig.delimiter ?? undefined,
        allowCodeEdit: payload.labelConfig.allowCodeEdit ?? undefined,
        regenerateOnType: payload.labelConfig.regenerateOnType ?? undefined
      },
      create: {
        id: payload.labelConfig.id || "default",
        language: payload.labelConfig.language || "de",
        separator: payload.labelConfig.separator || "-",
        digits: payload.labelConfig.digits ?? 3,
        prefix: payload.labelConfig.prefix ?? null,
        suffix: payload.labelConfig.suffix ?? null,
        recycleNumbers: payload.labelConfig.recycleNumbers ?? false,
        delimiter: payload.labelConfig.delimiter || ",",
        allowCodeEdit: payload.labelConfig.allowCodeEdit ?? true,
        regenerateOnType: payload.labelConfig.regenerateOnType ?? true
      }
    });
  }

  for (const counter of payload.sequenceCounters || []) {
    const resolvedAreaId = areaIdMap.get(counter.areaId) || counter.areaId;
    const resolvedTypeId = typeIdMap.get(counter.typeId) || counter.typeId;
    await prisma.sequenceCounter.upsert({
      where: {
        areaId_typeId: {
          areaId: resolvedAreaId,
          typeId: resolvedTypeId
        }
      },
      update: {
        nextNumber: counter.nextNumber
      },
      create: {
        id: counter.id,
        areaId: resolvedAreaId,
        typeId: resolvedTypeId,
        nextNumber: counter.nextNumber
      }
    });
  }

  for (const field of payload.customFields || []) {
    const restoredField = await prisma.customField.upsert({
      where: { key: field.key },
      update: {
        name: field.name,
        type: field.type,
        unit: field.unit ?? null,
        options: serializeOptions(field.options),
        valueCatalog: serializeJsonValue(field.valueCatalog),
        sortOrder: field.sortOrder ?? 0,
        required: !!field.required,
        isActive: field.isActive !== false,
        categoryId: field.categoryId ? categoryIdMap.get(field.categoryId) || field.categoryId : null,
        typeId: field.typeId ? typeIdMap.get(field.typeId) || field.typeId : null
      },
      create: {
        id: field.id,
        name: field.name,
        key: field.key,
        type: field.type,
        unit: field.unit ?? null,
        options: serializeOptions(field.options),
        valueCatalog: serializeJsonValue(field.valueCatalog),
        sortOrder: field.sortOrder ?? 0,
        required: !!field.required,
        isActive: field.isActive !== false,
        categoryId: field.categoryId ? categoryIdMap.get(field.categoryId) || field.categoryId : null,
        typeId: field.typeId ? typeIdMap.get(field.typeId) || field.typeId : null
      }
    });
    customFieldIdMap.set(field.id, restoredField.id);
  }

  let restoredUserScopes = 0;
  for (const user of payload.users || []) {
    const restoredUserId = userIdMap.get(user.id);
    if (!restoredUserId) continue;
    const locationIds = Array.from(
      new Set((user.allowedLocationIds || []).map((locationId) => locationIdMap.get(locationId) || locationId))
    );
    await prisma.userLocation.deleteMany({ where: { userId: restoredUserId } });
    for (const locationId of locationIds) {
      await prisma.userLocation
        .create({
          data: {
            userId: restoredUserId,
            storageLocationId: locationId
          }
        })
        .catch(() => null);
      restoredUserScopes += 1;
    }
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

  let restoredBomEntries = 0;
  for (const bom of payload.boms || []) {
    await prisma.billOfMaterial.upsert({
      where: {
        parentItemId_childItemId: {
          parentItemId: bom.parentItemId,
          childItemId: bom.childItemId
        }
      },
      update: { qty: bom.qty },
      create: {
        parentItemId: bom.parentItemId,
        childItemId: bom.childItemId,
        qty: bom.qty
      }
    });
    restoredBomEntries += 1;
  }

  let restoredAuditLogs = 0;
  for (const log of payload.auditLogs || []) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: {
        userId: log.userId ? userIdMap.get(log.userId) || fallbackUserId : null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        before: log.before === undefined ? null : typeof log.before === "string" ? log.before : JSON.stringify(log.before),
        after: log.after === undefined ? null : typeof log.after === "string" ? log.after : JSON.stringify(log.after)
      },
      create: {
        id: log.id,
        userId: log.userId ? userIdMap.get(log.userId) || fallbackUserId : null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        before: log.before === undefined ? null : typeof log.before === "string" ? log.before : JSON.stringify(log.before),
        after: log.after === undefined ? null : typeof log.after === "string" ? log.after : JSON.stringify(log.after),
        ...(parseDate(log.createdAt) ? { createdAt: parseDate(log.createdAt) } : {})
      }
    });
    restoredAuditLogs += 1;
  }

  return {
    conflicts,
    restoredCategories: (payload.categories || []).length,
    restoredLocations: (payload.locations || []).length,
    restoredShelves: (payload.shelves || []).length,
    restoredTags: (payload.tags || []).length,
    restoredAreas: (payload.areas || []).length,
    restoredTypes: (payload.types || []).length,
    restoredSequenceCounters: (payload.sequenceCounters || []).length,
    restoredItems: (payload.items || []).length,
    restoredBomEntries,
    restoredAuditLogs,
    restoredUsers,
    restoredUserScopes,
    placeholderUsers
  } satisfies RestoreResult;
}

export async function previewBackupRestore(input: {
  payload: BackupPayload;
  strategy: RestoreStrategy;
}) {
  const { payload, strategy } = input;
  const conflicts: RestoreResult["conflicts"] = {
    categories: [],
    locations: [],
    shelves: [],
    tags: [],
    items: [],
    areas: [],
    types: []
  };

  for (const category of payload.categories || []) {
    const existing = await prisma.category.findFirst({
      where: { OR: [{ id: category.id }, { name: category.name }] }
    });
    if (existing && strategy === "merge" && existing.id !== category.id) {
      conflicts.categories.push(category.name);
    }
  }

  for (const location of payload.locations || []) {
    const existing = await prisma.storageLocation.findFirst({
      where: { OR: [{ id: location.id }, { name: location.name }] }
    });
    if (existing && strategy === "merge" && existing.id !== location.id) {
      conflicts.locations.push(location.name);
    }
  }

  for (const shelf of payload.shelves || []) {
    const existing = await prisma.storageShelf.findFirst({
      where: {
        OR: [{ id: shelf.id }, { storageLocationId: shelf.storageLocationId, name: shelf.name }]
      }
    });
    if (existing && strategy === "merge" && existing.id !== shelf.id) {
      conflicts.shelves.push(`${shelf.name}`);
    }
  }

  for (const tag of payload.tags || []) {
    const existing = await prisma.tag.findFirst({
      where: { OR: [{ id: tag.id }, { name: tag.name }] }
    });
    if (existing && strategy === "merge" && existing.id !== tag.id) {
      conflicts.tags.push(tag.name);
    }
  }

  for (const area of payload.areas || []) {
    const existing = await prisma.area.findFirst({
      where: { OR: [{ id: area.id }, { code: area.code }] }
    });
    if (existing && strategy === "merge" && existing.id !== area.id) {
      conflicts.areas.push(area.code);
    }
  }

  for (const type of payload.types || []) {
    const existing = await prisma.labelType.findFirst({
      where: { OR: [{ id: type.id }, { code: type.code }] }
    });
    if (existing && strategy === "merge" && existing.id !== type.id) {
      conflicts.types.push(type.code);
    }
  }

  for (const item of payload.items || []) {
    const existing = await prisma.item.findFirst({
      where: { OR: [{ id: item.id }, { labelCode: item.labelCode }] }
    });
    if (existing && strategy === "merge" && existing.id !== item.id) {
      conflicts.items.push(item.labelCode);
    }
  }

  return {
    strategy,
    conflicts,
    summary: {
      users: (payload.users || []).length,
      categories: (payload.categories || []).length,
      locations: (payload.locations || []).length,
      shelves: (payload.shelves || []).length,
      tags: (payload.tags || []).length,
      areas: (payload.areas || []).length,
      types: (payload.types || []).length,
      sequenceCounters: (payload.sequenceCounters || []).length,
      items: (payload.items || []).length,
      boms: (payload.boms || []).length,
      auditLogs: (payload.auditLogs || []).length
    }
  };
}
