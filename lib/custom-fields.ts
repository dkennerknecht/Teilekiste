import type { Prisma, PrismaClient } from "@prisma/client";

type CustomFieldLookupDb =
  | Pick<PrismaClient, "customField">
  | Pick<Prisma.TransactionClient, "customField">;

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
  valueCatalog?: string | null;
  sortOrder?: number;
  required?: boolean;
  isActive?: boolean;
  categoryId?: string | null;
  typeId?: string | null;
  technicalFieldScopeAssignmentId?: string | null;
  managedPresetKey?: string | null;
  managedPresetFieldKey?: string | null;
  category?: { id: string; name: string; code?: string | null } | null;
  labelType?: { id: string; name: string; code: string } | null;
};

export type CustomFieldValueMap = Record<string, unknown>;
export type CustomFieldCatalogEntry = {
  value: string;
  aliases: string[];
  sortOrder: number;
};

export function reorderCustomFieldCatalogEntries(entries: CustomFieldCatalogEntry[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return entries;
  if (fromIndex < 0 || fromIndex >= entries.length || toIndex < 0 || toIndex >= entries.length) return entries;

  const next = [...entries];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return entries;
  next.splice(toIndex, 0, moved);

  return next.map((entry, index) => ({
    value: entry.value,
    aliases: entry.aliases,
    sortOrder: index
  }));
}

export function isManagedCustomField(field: Pick<CustomFieldRow, "managedPresetFieldKey">) {
  return Boolean(field.managedPresetFieldKey);
}

export class CustomFieldValidationError extends Error {
  fieldId?: string;

  constructor(message: string, fieldId?: string) {
    super(message);
    this.name = "CustomFieldValidationError";
    this.fieldId = fieldId;
  }
}

type CatalogSource = Pick<CustomFieldRow, "options" | "valueCatalog"> | string | null | undefined;

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

function resolveCatalogSource(input: CatalogSource) {
  if (!input || typeof input === "string") {
    return {
      options: typeof input === "string" ? input : null,
      valueCatalog: null
    };
  }

  return {
    options: input.options || null,
    valueCatalog: input.valueCatalog || null
  };
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

function parseLegacyCustomFieldOptions(input: CatalogSource) {
  const { options } = resolveCatalogSource(input);
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

export function parseCustomFieldOptions(input: CatalogSource) {
  const catalogValues = parseCustomFieldValueCatalog(input).map((entry) => entry.value);
  if (catalogValues.length) return catalogValues;
  return parseLegacyCustomFieldOptions(input);
}

function sanitizeCatalogEntry(entry: unknown, fallbackSortOrder = 0): CustomFieldCatalogEntry | null {
  if (typeof entry === "string") {
    const value = entry.trim();
    return value ? { value, aliases: [], sortOrder: fallbackSortOrder } : null;
  }

  if (!entry || typeof entry !== "object") return null;

  const candidate = entry as { value?: unknown; aliases?: unknown; sortOrder?: unknown };
  const value = String(candidate.value || "").trim();
  if (!value) return null;

  const aliases = Array.isArray(candidate.aliases)
    ? Array.from(
        new Set(
          candidate.aliases
            .map((alias) => String(alias || "").trim())
            .filter(Boolean)
        )
      )
    : [];

  const parsedSortOrder = Number(candidate.sortOrder);
  return {
    value,
    aliases,
    sortOrder: Number.isFinite(parsedSortOrder) ? Math.max(0, Math.trunc(parsedSortOrder)) : fallbackSortOrder
  };
}

export function parseCustomFieldValueCatalog(input: CatalogSource) {
  const { options, valueCatalog } = resolveCatalogSource(input);
  const rawEntries: unknown[] = [];

  if (valueCatalog) {
    try {
      const parsed = JSON.parse(valueCatalog);
      if (Array.isArray(parsed)) rawEntries.push(...parsed);
    } catch {
      // ignore invalid valueCatalog and fall back to legacy options
    }
  }

  if (!rawEntries.length) {
    parseLegacyCustomFieldOptions(options).forEach((option, index) => {
      rawEntries.push({ value: option, aliases: [], sortOrder: index });
    });
  }

  const seen = new Set<string>();
  return rawEntries
    .map((entry, index) => sanitizeCatalogEntry(entry, index))
    .filter((entry): entry is CustomFieldCatalogEntry => !!entry)
    .filter((entry) => {
      const normalized = normalizeLookupValue(entry.value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.value.localeCompare(right.value, "de"));
}

export function serializeCustomFieldValueCatalog(entries: CustomFieldCatalogEntry[] | null | undefined) {
  if (!entries?.length) return null;

  const normalizedEntries = entries
    .map((entry, index) => sanitizeCatalogEntry(entry, index))
    .filter((entry): entry is CustomFieldCatalogEntry => !!entry)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.value.localeCompare(right.value, "de"));

  return normalizedEntries.length ? JSON.stringify(normalizedEntries) : null;
}

function buildCatalogLookup(input: CatalogSource, suggestions: string[] = []) {
  const catalog = parseCustomFieldValueCatalog(input);
  const lookup = new Map<string, string>();

  for (const entry of catalog) {
    lookup.set(normalizeLookupValue(entry.value), entry.value);
    for (const alias of entry.aliases) {
      lookup.set(normalizeLookupValue(alias), entry.value);
    }
  }

  for (const suggestion of suggestions) {
    const trimmed = suggestion.trim();
    const normalized = normalizeLookupValue(trimmed);
    if (!normalized || lookup.has(normalized)) continue;
    lookup.set(normalized, trimmed);
  }

  return { catalog, lookup };
}

function normalizeCatalogInput(input: CatalogSource, value: string, suggestions: string[] = []) {
  const normalizedValue = normalizeLookupValue(value);
  if (!normalizedValue) return "";

  const { lookup } = buildCatalogLookup(input, suggestions);
  return lookup.get(normalizedValue) || value.trim();
}

function normalizeLockedCatalogValue(field: Pick<CustomFieldRow, "id" | "name" | "options" | "valueCatalog">, value: string, suggestions: string[] = []) {
  const normalizedValue = normalizeLookupValue(value);
  if (!normalizedValue) return "";

  const { lookup } = buildCatalogLookup(field, suggestions);
  const matched = lookup.get(normalizedValue);
  if (!matched) {
    throw new CustomFieldValidationError(`Unbekannter Listenwert fuer ${field.name}`, field.id);
  }
  return matched;
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

export async function createUniqueCustomFieldKey(db: CustomFieldLookupDb, name: string, excludeId?: string) {
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
  db: CustomFieldLookupDb,
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

export async function collectCustomFieldSuggestions(
  db: CustomFieldDb,
  field: Pick<CustomFieldRow, "id" | "options" | "valueCatalog">,
  query?: string
) {
  const usage = new Map<string, { value: string; count: number; priority: number }>();
  const normalizedQuery = normalizeLookupValue(query || "");

  for (const option of parseCustomFieldValueCatalog(field)) {
    const normalized = normalizeLookupValue(option.value);
    if (!normalized) continue;
    usage.set(normalized, { value: option.value, count: 0, priority: 2 });
    for (const alias of option.aliases) {
      const normalizedAlias = normalizeLookupValue(alias);
      if (!normalizedAlias || usage.has(normalizedAlias)) continue;
      usage.set(normalizedAlias, { value: option.value, count: 0, priority: 1 });
    }
  }

  const rows = await db.itemCustomFieldValue.findMany({
    where: { customFieldId: field.id },
    select: { valueJson: true }
  });

  for (const row of rows) {
    const parsed = parseStoredCustomFieldValue(row.valueJson);
    for (const suggestion of extractStringSuggestions(parsed)) {
      const canonicalValue = normalizeCatalogInput(field, suggestion);
      const normalized = normalizeLookupValue(canonicalValue);
      if (!normalized) continue;
      const current = usage.get(normalized);
      if (current) {
        current.count += 1;
        continue;
      }
      usage.set(normalized, { value: canonicalValue, count: 1, priority: 0 });
    }
  }

  return Array.from(usage.entries())
    .filter(([normalized]) => !normalizedQuery || normalized.includes(normalizedQuery))
    .sort(([, left], [, right]) => right.priority - left.priority || right.count - left.count || left.value.localeCompare(right.value, "de"))
    .map(([, entry]) => entry.value)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 8);
}

export function normalizeCustomFieldValue(
  field: Pick<CustomFieldRow, "id" | "name" | "type" | "options" | "valueCatalog">,
  value: unknown,
  suggestions: string[] = []
) {
  if (value === null || value === undefined) return null;

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
      return Array.from(
        new Set(
          entries
            .map((entry) => normalizeLockedCatalogValue(field, String(entry || "").trim(), suggestions))
            .filter(Boolean)
        )
      );
    }
    case "SELECT": {
      const text = String(value).trim();
      if (!text) return null;
      return normalizeLockedCatalogValue(field, text, suggestions);
    }
    case "TEXT":
    default: {
      const text = String(value).trim();
      if (!text) return null;
      return normalizeCatalogInput(field, text, suggestions);
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
        valueCatalog: true,
        sortOrder: true,
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
