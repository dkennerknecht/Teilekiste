import type { Prisma, PrismaClient } from "@prisma/client";

type CustomFieldDb =
  | Pick<PrismaClient, "customField" | "itemCustomFieldValue">
  | Pick<Prisma.TransactionClient, "customField" | "itemCustomFieldValue">;

export type CustomFieldRow = {
  id: string;
  name: string;
  key: string;
  type: string;
  unit?: string | null;
  options?: string | null;
  required?: boolean;
  isActive?: boolean;
  categoryId?: string | null;
  typeId?: string | null;
  category?: { id: string; name: string; code?: string | null } | null;
  labelType?: { id: string; name: string; code: string } | null;
};

export type CustomFieldValueMap = Record<string, unknown>;

function normalizeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

function normalizeLookupValue(value: string) {
  return normalizeAscii(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function buildCustomFieldKeyBase(name: string) {
  const normalized = normalizeLookupValue(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 80) || "field";
}

function canonicalizeTextValue(value: string, candidates: string[]) {
  const normalizedValue = normalizeLookupValue(value);
  if (!normalizedValue) return "";

  const match = candidates.find((candidate) => normalizeLookupValue(candidate) === normalizedValue);
  return match || value.trim();
}

function extractStringSuggestions(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => extractStringSuggestions(entry))
      .filter(Boolean);
  }

  return [];
}

export function parseCustomFieldOptions(options: string | null | undefined) {
  if (!options) return [];

  try {
    const parsed = JSON.parse(options);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
    }
  } catch {
    return options
      .split("|")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

export function fieldAppliesToSelection(field: Pick<CustomFieldRow, "categoryId" | "typeId">, categoryId?: string | null, typeId?: string | null) {
  if (field.categoryId && field.categoryId !== categoryId) return false;
  if (field.typeId && field.typeId !== typeId) return false;
  return true;
}

export function filterApplicableCustomFields<T extends Pick<CustomFieldRow, "categoryId" | "typeId">>(fields: T[], categoryId?: string | null, typeId?: string | null) {
  return fields.filter((field) => fieldAppliesToSelection(field, categoryId, typeId));
}

export function parseStoredCustomFieldValue(valueJson: string) {
  try {
    return JSON.parse(valueJson);
  } catch {
    return valueJson;
  }
}

export function buildCustomValueMap(rows: Array<{ customFieldId: string; valueJson: string }>) {
  return rows.reduce<CustomFieldValueMap>((acc, row) => {
    acc[row.customFieldId] = parseStoredCustomFieldValue(row.valueJson);
    return acc;
  }, {});
}

export function isEmptyCustomFieldValue(fieldType: string, value: unknown) {
  if (value === null || value === undefined) return true;

  if (fieldType === "MULTI_SELECT") {
    return !Array.isArray(value) || value.length === 0;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  return false;
}

export function formatCustomFieldValue(field: Pick<CustomFieldRow, "type" | "unit">, value: unknown) {
  if (value === null || value === undefined) return "-";

  let formatted = "";
  if (Array.isArray(value)) {
    formatted = value.map((entry) => String(entry)).join(", ");
  } else if (field.type === "BOOLEAN") {
    formatted = value ? "Ja" : "Nein";
  } else if (field.type === "DATE" && typeof value === "string") {
    const parsedDate = new Date(value);
    formatted = Number.isNaN(parsedDate.getTime()) ? value : parsedDate.toLocaleDateString("de-DE");
  } else {
    formatted = String(value);
  }

  if (!formatted || !field.unit || field.type === "BOOLEAN") return formatted || "-";
  return `${formatted} ${field.unit}`;
}

export async function createUniqueCustomFieldKey(db: CustomFieldDb, name: string, excludeId?: string) {
  const base = buildCustomFieldKeyBase(name);
  const existing = await db.customField.findMany({
    where: {
      key: {
        startsWith: base
      },
      ...(excludeId ? { id: { not: excludeId } } : {})
    },
    select: { key: true }
  });

  const taken = new Set(existing.map((row) => row.key));
  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function findConflictingCustomField(
  db: CustomFieldDb,
  input: {
    name: string;
    categoryId?: string | null;
    typeId?: string | null;
    excludeId?: string;
  }
) {
  return db.customField.findFirst({
    where: {
      name: input.name,
      categoryId: input.categoryId || null,
      typeId: input.typeId || null,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {})
    },
    select: { id: true }
  });
}

export async function collectCustomFieldSuggestions(db: CustomFieldDb, field: Pick<CustomFieldRow, "id" | "options">, query?: string) {
  const usage = new Map<string, { value: string; count: number; priority: number }>();
  const normalizedQuery = normalizeLookupValue(query || "");

  for (const option of parseCustomFieldOptions(field.options)) {
    const normalized = normalizeLookupValue(option);
    if (!normalized) continue;
    usage.set(normalized, { value: option, count: 0, priority: 1 });
  }

  const rows = await db.itemCustomFieldValue.findMany({
    where: { customFieldId: field.id },
    select: { valueJson: true }
  });

  for (const row of rows) {
    const parsed = parseStoredCustomFieldValue(row.valueJson);
    for (const suggestion of extractStringSuggestions(parsed)) {
      const normalized = normalizeLookupValue(suggestion);
      if (!normalized) continue;
      const current = usage.get(normalized);
      if (current) {
        current.count += 1;
        continue;
      }
      usage.set(normalized, { value: suggestion, count: 1, priority: 0 });
    }
  }

  return Array.from(usage.entries())
    .filter(([normalized]) => !normalizedQuery || normalized.includes(normalizedQuery))
    .sort(([, left], [, right]) => right.priority - left.priority || right.count - left.count || left.value.localeCompare(right.value, "de"))
    .map(([, entry]) => entry.value)
    .slice(0, 8);
}

export function normalizeCustomFieldValue(field: Pick<CustomFieldRow, "type" | "options">, value: unknown, suggestions: string[] = []) {
  if (value === null || value === undefined) return null;

  const candidates = [...parseCustomFieldOptions(field.options), ...suggestions];

  switch (field.type) {
    case "NUMBER": {
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      const numeric = Number(String(value).replace(",", "."));
      return Number.isFinite(numeric) ? numeric : null;
    }
    case "BOOLEAN":
      return Boolean(value);
    case "DATE": {
      const text = String(value).trim();
      return text || null;
    }
    case "MULTI_SELECT": {
      const entries = Array.isArray(value) ? value : [value];
      const normalizedEntries = Array.from(
        new Set(
          entries
            .map((entry) => canonicalizeTextValue(String(entry || "").trim(), candidates))
            .filter(Boolean)
        )
      );
      return normalizedEntries;
    }
    case "SELECT":
    case "TEXT":
    default: {
      const text = String(value).trim();
      if (!text) return null;
      return canonicalizeTextValue(text, candidates);
    }
  }
}

export async function prepareCustomFieldValueWrites(
  db: CustomFieldDb,
  input: {
    rawValues?: Record<string, unknown> | null;
    categoryId?: string | null;
    typeId?: string | null;
  }
) {
  const rawValues = input.rawValues || {};
  const fieldIds = Object.keys(rawValues);
  if (!fieldIds.length) {
    return {
      upserts: [] as Array<{ customFieldId: string; valueJson: string }>,
      deletions: [] as string[]
    };
  }

  const fields = filterApplicableCustomFields(
    await db.customField.findMany({
      where: {
        id: { in: fieldIds },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        key: true,
        type: true,
        unit: true,
        options: true,
        required: true,
        isActive: true,
        categoryId: true,
        typeId: true
      }
    }),
    input.categoryId,
    input.typeId
  );

  const suggestionMap = new Map<string, string[]>();
  for (const field of fields) {
    if (field.type === "TEXT" || field.type === "SELECT" || field.type === "MULTI_SELECT") {
      suggestionMap.set(field.id, await collectCustomFieldSuggestions(db, field));
    }
  }

  const upserts: Array<{ customFieldId: string; valueJson: string }> = [];
  const deletions: string[] = [];

  for (const field of fields) {
    const normalizedValue = normalizeCustomFieldValue(field, rawValues[field.id], suggestionMap.get(field.id) || []);
    if (isEmptyCustomFieldValue(field.type, normalizedValue)) {
      deletions.push(field.id);
      continue;
    }
    upserts.push({
      customFieldId: field.id,
      valueJson: JSON.stringify(normalizedValue)
    });
  }

  return { upserts, deletions };
}
