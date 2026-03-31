import type { Prisma, PrismaClient } from "@prisma/client";
import { getStoredTechnicalFieldPreset, listTechnicalFieldPresets } from "@/lib/custom-field-presets";
import {
  createUniqueCustomFieldKey,
  findConflictingCustomField,
  serializeCustomFieldValueCatalog
} from "@/lib/custom-fields";

type TechnicalFieldAssignmentDb =
  | Pick<PrismaClient, "technicalFieldScopeAssignment" | "customField" | "technicalFieldPreset">
  | Pick<Prisma.TransactionClient, "technicalFieldScopeAssignment" | "customField" | "technicalFieldPreset">
  | (Pick<PrismaClient, "technicalFieldScopeAssignment" | "customField"> & { technicalFieldPreset?: undefined })
  | (Pick<Prisma.TransactionClient, "technicalFieldScopeAssignment" | "customField"> & { technicalFieldPreset?: undefined });

export class TechnicalFieldAssignmentError extends Error {}

function buildManagedFieldIdentity(presetKey: string, presetFieldKey: string) {
  return `${presetKey}::${presetFieldKey}`;
}

async function buildManagedCustomFieldKey(
  db: TechnicalFieldAssignmentDb,
  input: { presetKey: string; presetFieldKey: string; categoryId: string; typeId: string }
) {
  return createUniqueCustomFieldKey(
    db,
    `tech-${input.presetKey}-${input.presetFieldKey}-${input.categoryId.slice(0, 8)}-${input.typeId.slice(0, 8)}`
  );
}

export async function syncTechnicalFieldScopeAssignment(
  db: TechnicalFieldAssignmentDb,
  input: { categoryId: string; typeId: string; presetKey: string }
) {
  const preset = await getStoredTechnicalFieldPreset(db, input.presetKey);
  if (!preset) {
    throw new TechnicalFieldAssignmentError("Technischer Feldsatz nicht gefunden");
  }

  const assignment = await db.technicalFieldScopeAssignment.upsert({
    where: {
      categoryId_typeId: {
        categoryId: input.categoryId,
        typeId: input.typeId
      }
    },
    update: {
      presetKey: preset.key
    },
    create: {
      categoryId: input.categoryId,
      typeId: input.typeId,
      presetKey: preset.key
    }
  });

  const existingManagedFields = await db.customField.findMany({
    where: {
      categoryId: input.categoryId,
      typeId: input.typeId,
      managedPresetFieldKey: { not: null }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  const existingManagedFieldMap = new Map(
    existingManagedFields.map((field) => [
      buildManagedFieldIdentity(field.managedPresetKey || "", field.managedPresetFieldKey || ""),
      field
    ])
  );

  const activeIdentities = new Set<string>();
  const createdFieldIds: string[] = [];
  const reactivatedFieldIds: string[] = [];

  for (const presetField of preset.fields) {
    const identity = buildManagedFieldIdentity(preset.key, presetField.key);
    activeIdentities.add(identity);
    const existingField = existingManagedFieldMap.get(identity) || null;
    const conflict = await findConflictingCustomField(db, {
      name: presetField.name,
      categoryId: input.categoryId,
      typeId: input.typeId,
      excludeId: existingField?.id
    });
    if (conflict) {
      throw new TechnicalFieldAssignmentError(`Namenskonflikt fuer technisches Feld "${presetField.name}" im Scope`);
    }

    const fieldData = {
      name: presetField.name,
      type: presetField.type,
      unit: presetField.unit || null,
      options: null,
      valueCatalog: serializeCustomFieldValueCatalog(presetField.valueCatalog || null),
      sortOrder: presetField.sortOrder,
      required: !!presetField.required,
      categoryId: input.categoryId,
      typeId: input.typeId,
      technicalFieldScopeAssignmentId: assignment.id,
      managedPresetKey: preset.key,
      managedPresetFieldKey: presetField.key,
      isActive: true
    };

    if (existingField) {
      await db.customField.update({
        where: { id: existingField.id },
        data: fieldData
      });
      if (!existingField.isActive) {
        reactivatedFieldIds.push(existingField.id);
      }
      continue;
    }

    const key = await buildManagedCustomFieldKey(db, {
      presetKey: preset.key,
      presetFieldKey: presetField.key,
      categoryId: input.categoryId,
      typeId: input.typeId
    });
    const createdField = await db.customField.create({
      data: {
        ...fieldData,
        key
      }
    });
    createdFieldIds.push(createdField.id);
  }

  const staleFieldIds = existingManagedFields
    .filter((field) => !activeIdentities.has(buildManagedFieldIdentity(field.managedPresetKey || "", field.managedPresetFieldKey || "")))
    .map((field) => field.id);

  if (staleFieldIds.length) {
    await db.customField.updateMany({
      where: { id: { in: staleFieldIds } },
      data: {
        isActive: false,
        technicalFieldScopeAssignmentId: assignment.id
      }
    });
  }

  const fields = await db.customField.findMany({
    where: {
      categoryId: input.categoryId,
      typeId: input.typeId,
      managedPresetFieldKey: { not: null }
    },
    include: {
      category: true,
      labelType: {
        select: { id: true, name: true, code: true }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });

  return {
    assignment,
    preset,
    fields,
    createdFieldIds,
    reactivatedFieldIds,
    deactivatedFieldIds: staleFieldIds
  };
}

export async function removeTechnicalFieldScopeAssignment(
  db: TechnicalFieldAssignmentDb,
  input: { id: string }
) {
  const assignment = await db.technicalFieldScopeAssignment.findUnique({
    where: { id: input.id }
  });
  if (!assignment) return null;

  await db.customField.updateMany({
    where: {
      categoryId: assignment.categoryId,
      typeId: assignment.typeId,
      managedPresetFieldKey: { not: null }
    },
    data: {
      isActive: false,
      technicalFieldScopeAssignmentId: null
    }
  });

  await db.technicalFieldScopeAssignment.delete({
    where: { id: assignment.id }
  });

  return assignment;
}

export async function listTechnicalFieldScopeAssignments(db: TechnicalFieldAssignmentDb) {
  const presets = await listTechnicalFieldPresets(db);
  const presetMap = new Map(presets.map((preset) => [preset.key, preset]));
  const assignments = await db.technicalFieldScopeAssignment.findMany({
    include: {
      category: true,
      labelType: {
        select: { id: true, name: true, code: true }
      }
    },
    orderBy: [{ category: { name: "asc" } }, { labelType: { code: "asc" } }]
  });

  const scopes = assignments.map((assignment) => ({
    ...assignment,
    preset: presetMap.get(assignment.presetKey)
      ? {
          key: assignment.presetKey,
          name: presetMap.get(assignment.presetKey)!.name
        }
      : {
          key: assignment.presetKey,
          name: assignment.presetKey
        }
  }));

  return scopes;
}
