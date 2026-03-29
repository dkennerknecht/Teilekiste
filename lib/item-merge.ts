import type { Prisma, PrismaClient } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import {
  formatCustomFieldValue,
  isEmptyCustomFieldValue,
  parseStoredCustomFieldValue,
  type CustomFieldRow
} from "@/lib/custom-fields";
import { formatDisplayQuantity, serializeStoredQuantity } from "@/lib/quantity";
import { getMergeEligibility } from "@/lib/item-duplicates";

type MergeDb =
  | PrismaClient
  | Prisma.TransactionClient;

type MergeSelection = "source" | "target";

type MergeLoadedItem = NonNullable<Awaited<ReturnType<typeof loadMergeItem>>>;

type MergeCoreFieldKey =
  | "name"
  | "description"
  | "manufacturer"
  | "mpn"
  | "datasheetUrl"
  | "purchaseUrl"
  | "storageLocationId"
  | "storageArea"
  | "bin"
  | "minStock";

export class DuplicateMergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateMergeError";
  }
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function labelSelection(value: MergeSelection) {
  return value;
}

function formatItemFieldValue(item: MergeLoadedItem, fieldKey: MergeCoreFieldKey, value: unknown) {
  if (fieldKey === "storageLocationId") {
    if (!value) return "-";
    return item.storageLocation?.name || String(value);
  }
  if (fieldKey === "minStock") {
    return formatDisplayQuantity(item.unit, serializeStoredQuantity(item.unit, typeof value === "number" ? value : null));
  }
  return isBlank(value) ? "-" : String(value);
}

function coreFieldMeta() {
  return [
    { key: "name", label: "Name" },
    { key: "description", label: "Beschreibung" },
    { key: "manufacturer", label: "Hersteller" },
    { key: "mpn", label: "MPN" },
    { key: "datasheetUrl", label: "Datenblatt-URL" },
    { key: "purchaseUrl", label: "Kauf-URL" },
    { key: "storageLocationId", label: "Lagerort" },
    { key: "storageArea", label: "Regal" },
    { key: "bin", label: "Fach" },
    { key: "minStock", label: "Mindestbestand" }
  ] as const satisfies Array<{ key: MergeCoreFieldKey; label: string }>;
}

function resolveDefaultSelection(sourceValue: unknown, targetValue: unknown): MergeSelection {
  if (isBlank(targetValue) && !isBlank(sourceValue)) return "source";
  return "target";
}

async function loadMergeItem(db: MergeDb, itemId: string) {
  return db.item.findUnique({
    where: { id: itemId },
    include: {
      category: {
        select: { id: true, name: true, code: true }
      },
      labelType: {
        select: { id: true, code: true, name: true }
      },
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      tags: {
        include: {
          tag: {
            select: { id: true, name: true }
          }
        }
      },
      images: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      },
      attachments: true,
      movements: true,
      reservations: true,
      favorites: true,
      recentViews: true,
      customValues: {
        include: {
          customField: {
            select: {
              id: true,
              name: true,
              key: true,
              type: true,
              unit: true,
              options: true,
              valueCatalog: true
            }
          }
        }
      },
      bomChildren: true,
      bomParents: true
    }
  });
}

async function loadMergePairOrThrow(db: MergeDb, input: { sourceItemId: string; targetItemId: string }) {
  const [source, target] = await Promise.all([loadMergeItem(db, input.sourceItemId), loadMergeItem(db, input.targetItemId)]);
  if (!source || !target) {
    throw new DuplicateMergeError("Quelle oder Ziel nicht gefunden");
  }
  return { source, target };
}

function ensureMergeablePair(source: MergeLoadedItem, target: MergeLoadedItem) {
  if (!source || !target) {
    throw new DuplicateMergeError("Quelle oder Ziel nicht gefunden");
  }

  const eligibility = getMergeEligibility(source, target);
  if (!eligibility.mergeEligible) {
    throw new DuplicateMergeError(eligibility.mergeBlockedReasons[0] || "Merge nicht moeglich");
  }
}

function buildCoreFieldConflicts(source: MergeLoadedItem, target: MergeLoadedItem) {
  return coreFieldMeta().map((field) => {
    const sourceValue = source[field.key];
    const targetValue = target[field.key];
    const sameValue = JSON.stringify(sourceValue) === JSON.stringify(targetValue);
    const defaultSelection = resolveDefaultSelection(sourceValue, targetValue);
    const requiresSelection = !sameValue && !isBlank(sourceValue) && !isBlank(targetValue);

    return {
      fieldKey: field.key,
      label: field.label,
      sourceValue,
      targetValue,
      sourceDisplayValue: formatItemFieldValue(source, field.key, sourceValue),
      targetDisplayValue: formatItemFieldValue(target, field.key, targetValue),
      defaultSelection: labelSelection(defaultSelection),
      requiresSelection
    };
  });
}

function buildCustomFieldConflicts(source: MergeLoadedItem, target: MergeLoadedItem) {
  const sourceMap = new Map(source.customValues.map((entry) => [entry.customFieldId, entry]));
  const targetMap = new Map(target.customValues.map((entry) => [entry.customFieldId, entry]));
  const allFieldIds = Array.from(new Set([...sourceMap.keys(), ...targetMap.keys()]));

  return allFieldIds
    .map((fieldId) => {
      const sourceEntry = sourceMap.get(fieldId) || null;
      const targetEntry = targetMap.get(fieldId) || null;
      const field = (sourceEntry?.customField || targetEntry?.customField || null) as CustomFieldRow | null;
      if (!field) return null;

      const sourceValue = sourceEntry ? parseStoredCustomFieldValue(sourceEntry.valueJson) : null;
      const targetValue = targetEntry ? parseStoredCustomFieldValue(targetEntry.valueJson) : null;
      const sourceEmpty = isEmptyCustomFieldValue(field.type, sourceValue);
      const targetEmpty = isEmptyCustomFieldValue(field.type, targetValue);
      const sameValue = JSON.stringify(sourceValue) === JSON.stringify(targetValue);
      const defaultSelection = resolveDefaultSelection(sourceEmpty ? null : sourceValue, targetEmpty ? null : targetValue);
      const requiresSelection = !sameValue && !sourceEmpty && !targetEmpty;

      return {
        customFieldId: fieldId,
        fieldName: field.name,
        fieldType: field.type,
        sourceValue,
        targetValue,
        sourceDisplayValue: sourceEmpty ? "-" : formatCustomFieldValue(field, sourceValue),
        targetDisplayValue: targetEmpty ? "-" : formatCustomFieldValue(field, targetValue),
        defaultSelection: labelSelection(defaultSelection),
        requiresSelection
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .sort((left, right) => left.fieldName.localeCompare(right.fieldName, "de"));
}

function buildRelationCounts(source: MergeLoadedItem, target: MergeLoadedItem) {
  return {
    source: {
      tags: source.tags.length,
      images: source.images.length,
      attachments: source.attachments.length,
      movements: source.movements.length,
      reservations: source.reservations.length,
      favorites: source.favorites.length,
      recentViews: source.recentViews.length,
      customValues: source.customValues.length,
      bomAsParent: source.bomChildren.length,
      bomAsChild: source.bomParents.length
    },
    target: {
      tags: target.tags.length,
      images: target.images.length,
      attachments: target.attachments.length,
      movements: target.movements.length,
      reservations: target.reservations.length,
      favorites: target.favorites.length,
      recentViews: target.recentViews.length,
      customValues: target.customValues.length,
      bomAsParent: target.bomChildren.length,
      bomAsChild: target.bomParents.length
    }
  };
}

function ensureNoBomSelfReference(source: MergeLoadedItem, target: MergeLoadedItem) {
  const createsParentSelfReference = source.bomChildren.some((entry) => entry.childItemId === target.id);
  const createsChildSelfReference = source.bomParents.some((entry) => entry.parentItemId === target.id);

  if (createsParentSelfReference || createsChildSelfReference) {
    throw new DuplicateMergeError("Merge wuerde eine ungueltige BOM-Selbstreferenz erzeugen");
  }
}

export async function buildDuplicateMergePreview(db: MergeDb, input: { sourceItemId: string; targetItemId: string }) {
  const { source, target } = await loadMergePairOrThrow(db, input);
  ensureMergeablePair(source, target);
  ensureNoBomSelfReference(source, target);

  const coreFieldConflicts = buildCoreFieldConflicts(source, target);
  const customFieldConflicts = buildCustomFieldConflicts(source, target);

  return {
    sourceItem: {
      id: source.id,
      labelCode: source.labelCode,
      name: source.name,
      stock: serializeStoredQuantity(source.unit, source.stock),
      unit: source.unit,
      category: source.category,
      labelType: source.labelType,
      storageLocation: source.storageLocation
    },
    targetItem: {
      id: target.id,
      labelCode: target.labelCode,
      name: target.name,
      stock: serializeStoredQuantity(target.unit, target.stock),
      unit: target.unit,
      category: target.category,
      labelType: target.labelType,
      storageLocation: target.storageLocation
    },
    scoreInfo: {
      resultingStock: serializeStoredQuantity(target.unit, target.stock + source.stock),
      unit: target.unit
    },
    relationCounts: buildRelationCounts(source, target),
    coreFieldConflicts,
    customFieldConflicts,
    defaultFieldSelections: Object.fromEntries(
      coreFieldConflicts.map((field) => [field.fieldKey, field.defaultSelection])
    ),
    defaultCustomFieldSelections: Object.fromEntries(
      customFieldConflicts.map((field) => [field.customFieldId, field.defaultSelection])
    )
  };
}

function selectValue<T>(sourceValue: T, targetValue: T, selection: MergeSelection) {
  return selection === "source" ? sourceValue : targetValue;
}

function normalizeSelection(selection: unknown, fallback: MergeSelection): MergeSelection {
  return selection === "source" || selection === "target" ? selection : fallback;
}

async function mergeBomEntries(db: Prisma.TransactionClient, input: { source: MergeLoadedItem; target: MergeLoadedItem }) {
  for (const entry of input.source.bomChildren) {
    const existing = await db.billOfMaterial.findUnique({
      where: {
        parentItemId_childItemId: {
          parentItemId: input.target.id,
          childItemId: entry.childItemId
        }
      }
    });

    if (existing) {
      await db.billOfMaterial.update({
        where: { id: existing.id },
        data: { qty: { increment: entry.qty } }
      });
      await db.billOfMaterial.delete({ where: { id: entry.id } });
    } else {
      await db.billOfMaterial.update({
        where: { id: entry.id },
        data: { parentItemId: input.target.id }
      });
    }
  }

  for (const entry of input.source.bomParents) {
    const existing = await db.billOfMaterial.findUnique({
      where: {
        parentItemId_childItemId: {
          parentItemId: entry.parentItemId,
          childItemId: input.target.id
        }
      }
    });

    if (existing) {
      await db.billOfMaterial.update({
        where: { id: existing.id },
        data: { qty: { increment: entry.qty } }
      });
      await db.billOfMaterial.delete({ where: { id: entry.id } });
    } else {
      await db.billOfMaterial.update({
        where: { id: entry.id },
        data: { childItemId: input.target.id }
      });
    }
  }
}

async function mergeFavorites(db: Prisma.TransactionClient, input: { source: MergeLoadedItem; target: MergeLoadedItem }) {
  for (const favorite of input.source.favorites) {
    await db.favorite.upsert({
      where: {
        userId_itemId: {
          userId: favorite.userId,
          itemId: input.target.id
        }
      },
      update: {},
      create: {
        userId: favorite.userId,
        itemId: input.target.id
      }
    });
  }

  await db.favorite.deleteMany({ where: { itemId: input.source.id } });
}

async function mergeRecentViews(db: Prisma.TransactionClient, input: { source: MergeLoadedItem; target: MergeLoadedItem }) {
  for (const recentView of input.source.recentViews) {
    const existing = await db.recentView.findUnique({
      where: {
        userId_itemId: {
          userId: recentView.userId,
          itemId: input.target.id
        }
      }
    });

    if (existing) {
      if (existing.lastViewedAt < recentView.lastViewedAt) {
        await db.recentView.update({
          where: {
            userId_itemId: {
              userId: recentView.userId,
              itemId: input.target.id
            }
          },
          data: { lastViewedAt: recentView.lastViewedAt }
        });
      }
    } else {
      await db.recentView.create({
        data: {
          userId: recentView.userId,
          itemId: input.target.id,
          lastViewedAt: recentView.lastViewedAt
        }
      });
    }
  }

  await db.recentView.deleteMany({ where: { itemId: input.source.id } });
}

async function mergeImages(db: Prisma.TransactionClient, input: { source: MergeLoadedItem; target: MergeLoadedItem }) {
  if (!input.source.images.length) return;

  const targetMaxSortOrder = input.target.images.reduce((max, image) => Math.max(max, image.sortOrder || 0), 0);
  const targetHasPrimary = input.target.images.some((image) => image.isPrimary);
  const orderedSourceImages = [...input.source.images].sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0));
  const sourcePrimaryId = orderedSourceImages.find((image) => image.isPrimary)?.id || orderedSourceImages[0]?.id || null;

  for (let index = 0; index < orderedSourceImages.length; index += 1) {
    const image = orderedSourceImages[index];
    await db.itemImage.update({
      where: { id: image.id },
      data: {
        itemId: input.target.id,
        sortOrder: targetMaxSortOrder + index + 1,
        isPrimary: !targetHasPrimary && image.id === sourcePrimaryId
      }
    });
  }
}

async function mergeCustomValues(
  db: Prisma.TransactionClient,
  input: {
    source: MergeLoadedItem;
    target: MergeLoadedItem;
    customFieldSelections?: Record<string, MergeSelection>;
  }
) {
  const conflicts = buildCustomFieldConflicts(input.source, input.target);

  for (const conflict of conflicts) {
    const selection = normalizeSelection(
      input.customFieldSelections?.[conflict.customFieldId],
      conflict.defaultSelection
    );
    const selectedValue = selectValue(conflict.sourceValue, conflict.targetValue, selection);

    if (isEmptyCustomFieldValue(conflict.fieldType, selectedValue)) {
      await db.itemCustomFieldValue.deleteMany({
        where: {
          itemId: input.target.id,
          customFieldId: conflict.customFieldId
        }
      });
      continue;
    }

    await db.itemCustomFieldValue.upsert({
      where: {
        itemId_customFieldId: {
          itemId: input.target.id,
          customFieldId: conflict.customFieldId
        }
      },
      update: { valueJson: JSON.stringify(selectedValue) },
      create: {
        itemId: input.target.id,
        customFieldId: conflict.customFieldId,
        valueJson: JSON.stringify(selectedValue)
      }
    });
  }

  await db.itemCustomFieldValue.deleteMany({ where: { itemId: input.source.id } });
}

export async function performDuplicateMerge(
  db: Prisma.TransactionClient,
  input: {
    sourceItemId: string;
    targetItemId: string;
    fieldSelections?: Record<string, MergeSelection>;
    customFieldSelections?: Record<string, MergeSelection>;
    userId?: string;
  }
) {
  const { source, target } = await loadMergePairOrThrow(db, input);
  ensureMergeablePair(source, target);
  ensureNoBomSelfReference(source, target);

  const coreConflicts = buildCoreFieldConflicts(source, target);
  const coreSelections = Object.fromEntries(
    coreConflicts.map((field) => [
      field.fieldKey,
      normalizeSelection(input.fieldSelections?.[field.fieldKey], field.defaultSelection)
    ])
  ) as Record<MergeCoreFieldKey, MergeSelection>;

  const updatedTarget = await db.item.update({
    where: { id: target.id },
    data: {
      name: selectValue(source.name, target.name, coreSelections.name),
      description: selectValue(source.description, target.description, coreSelections.description),
      manufacturer: selectValue(source.manufacturer || null, target.manufacturer || null, coreSelections.manufacturer),
      mpn: selectValue(source.mpn || null, target.mpn || null, coreSelections.mpn),
      datasheetUrl: selectValue(source.datasheetUrl || null, target.datasheetUrl || null, coreSelections.datasheetUrl),
      purchaseUrl: selectValue(source.purchaseUrl || null, target.purchaseUrl || null, coreSelections.purchaseUrl),
      storageLocationId: selectValue(source.storageLocationId, target.storageLocationId, coreSelections.storageLocationId),
      storageArea: selectValue(source.storageArea || null, target.storageArea || null, coreSelections.storageArea),
      bin: selectValue(source.bin || null, target.bin || null, coreSelections.bin),
      minStock: selectValue(source.minStock ?? null, target.minStock ?? null, coreSelections.minStock),
      stock: target.stock + source.stock
    }
  });

  for (const tagRel of source.tags) {
    await db.itemTag.upsert({
      where: {
        itemId_tagId: {
          itemId: target.id,
          tagId: tagRel.tagId
        }
      },
      update: {},
      create: {
        itemId: target.id,
        tagId: tagRel.tagId
      }
    });
  }
  await db.itemTag.deleteMany({ where: { itemId: source.id } });

  await mergeImages(db, { source, target });
  await db.attachment.updateMany({ where: { itemId: source.id }, data: { itemId: target.id } });
  await db.stockMovement.updateMany({ where: { itemId: source.id }, data: { itemId: target.id } });
  await db.reservation.updateMany({ where: { itemId: source.id }, data: { itemId: target.id } });
  await mergeFavorites(db, { source, target });
  await mergeRecentViews(db, { source, target });
  await mergeCustomValues(db, { source, target, customFieldSelections: input.customFieldSelections });
  await mergeBomEntries(db, { source, target });

  const mergedSource = await db.item.update({
    where: { id: source.id },
    data: {
      stock: 0,
      isArchived: true,
      mergedIntoItemId: target.id,
      mergedAt: new Date()
    }
  });

  await auditLog(
    {
      userId: input.userId,
      action: "ITEM_MERGE",
      entity: "Item",
      entityId: target.id,
      before: {
        sourceItemId: source.id,
        sourceLabelCode: source.labelCode,
        targetItemId: target.id,
        targetLabelCode: target.labelCode,
        targetStock: target.stock
      },
      after: {
        sourceItemId: mergedSource.id,
        targetItemId: updatedTarget.id,
        targetStock: updatedTarget.stock,
        fieldSelections: coreSelections,
        customFieldSelections: input.customFieldSelections || {},
        movedRelations: buildRelationCounts(source, target).source
      }
    },
    db
  );

  return {
    targetItemId: updatedTarget.id,
    sourceItemId: mergedSource.id,
    targetLabelCode: updatedTarget.labelCode,
    sourceLabelCode: mergedSource.labelCode
  };
}
