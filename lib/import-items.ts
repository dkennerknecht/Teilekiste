import type { Prisma, PrismaClient } from "@prisma/client";
import {
  CustomFieldValidationError,
  fieldAppliesToSelection,
  filterApplicableCustomFields,
  formatCustomFieldValue,
  prepareCustomFieldValueWrites,
  type CustomFieldRow
} from "@/lib/custom-fields";
import { findDuplicateCandidates, type DuplicateItemRecord } from "@/lib/item-duplicates";
import {
  buildImportHeaderFingerprint,
  buildSuggestedImportMappingConfig,
  getImportProfileMatchScore,
  hydrateImportProfile,
  mergeImportMappingConfigs,
  normalizeImportLookup,
  parseImportCsv,
  parseImportProfileMappingConfig,
  type ImportProfileAssignment,
  type ImportProfileMappingConfig,
  type ImportProfileRow
} from "@/lib/import-profiles";
import { QuantityValidationError, serializeStoredQuantity, toStoredQuantity } from "@/lib/quantity";
import { itemSchema } from "@/lib/validation";

type ImportDb =
  | Pick<PrismaClient, "customField" | "itemCustomFieldValue" | "category" | "labelType" | "storageLocation" | "item">
  | Pick<Prisma.TransactionClient, "customField" | "itemCustomFieldValue" | "category" | "labelType" | "storageLocation" | "item">;

type LookupRow = {
  id: string;
  name: string;
  code?: string | null;
};

export type ImportStructuredMessage = {
  fieldKey: string;
  message: string;
};

export type ImportHeaderPreview = {
  header: string;
  mappedTargetKeys: string[];
  suggestedTargetKeys: string[];
  status: "mapped" | "suggested" | "ignored" | "unmapped";
};

export type ImportResolvedCustomFieldPreview = {
  customFieldId: string;
  fieldName: string;
  displayValue: string;
};

export type ImportResolvedRowPreview = {
  name: string;
  category: { id: string; name: string; code?: string | null } | null;
  type: { id: string; name: string; code?: string | null } | null;
  storageLocation: { id: string; name: string; code?: string | null } | null;
  unit: string;
  stock: number;
  minStock: number | null;
  manufacturer: string | null;
  mpn: string | null;
  datasheetUrl: string | null;
  purchaseUrl: string | null;
  customFields: ImportResolvedCustomFieldPreview[];
};

export type ImportPreviewRow = {
  lineNumber: number;
  status: "ready" | "error";
  input: Record<string, string>;
  resolved: ImportResolvedRowPreview | null;
  errors: ImportStructuredMessage[];
  warnings: ImportStructuredMessage[];
};

type PreparedImportRow = {
  lineNumber: number;
  itemInput: ReturnType<typeof itemSchema.parse>;
  rawCustomValues: Record<string, unknown>;
  responseRow: ImportPreviewRow;
};

export type ImportMappingIssue = {
  fieldKey: string;
  message: string;
};

export type ImportPreviewProfileMatch = {
  id: string;
  name: string;
  description?: string | null;
  score: number;
  delimiterMode: string;
};

export type ImportPreviewResult = {
  delimiter: string;
  delimiterMode: string;
  headerFingerprint: string;
  headers: ImportHeaderPreview[];
  mappingConfig: ImportProfileMappingConfig;
  mappingIssues: ImportMappingIssue[];
  profileMatches: ImportPreviewProfileMatch[];
  totalRows: number;
  readyRowsCount: number;
  errorsCount: number;
  warningsCount: number;
  rows: ImportPreviewRow[];
  preparedRows: PreparedImportRow[];
};

type BuildPreviewInput = {
  db: ImportDb;
  text: string;
  allowedLocationIds: string[] | null;
  categories: LookupRow[];
  types: LookupRow[];
  locations: LookupRow[];
  customFields: CustomFieldRow[];
  duplicateItems: DuplicateItemRecord[];
  profiles?: ImportProfileRow[];
  selectedProfileId?: string | null;
  mappingDraft?: unknown;
  forcedTypeId?: string | null;
};

function parseNumber(value: string | null | undefined, fallback = 0) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  const numeric = Number(trimmed.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function resolveLookupMaps(rows: LookupRow[]) {
  const byId = new Map<string, LookupRow>();
  const byLookup = new Map<string, LookupRow>();

  for (const row of rows) {
    byId.set(row.id, row);
    const normalizedName = normalizeImportLookup(row.name);
    if (normalizedName && !byLookup.has(normalizedName)) {
      byLookup.set(normalizedName, row);
    }
    const normalizedCode = normalizeImportLookup(row.code || "");
    if (normalizedCode && !byLookup.has(normalizedCode)) {
      byLookup.set(normalizedCode, row);
    }
    const normalizedId = normalizeImportLookup(row.id);
    if (normalizedId && !byLookup.has(normalizedId)) {
      byLookup.set(normalizedId, row);
    }
  }

  return { byId, byLookup };
}

function normalizeUnit(value: string | null | undefined) {
  const unit = String(value || "STK").trim().toUpperCase();
  return ["STK", "M", "SET", "PACK"].includes(unit) ? unit : unit;
}

function buildAssignmentMap(config: ImportProfileMappingConfig) {
  return new Map(config.assignments.map((assignment) => [assignment.targetKey, assignment]));
}

function getAssignmentValue(assignment: ImportProfileAssignment | undefined, row: Record<string, string>) {
  if (!assignment || assignment.sourceType === "ignore") return null;
  if (assignment.sourceType === "fixed") return String(assignment.fixedValue || "").trim() || null;
  return String(row[assignment.column || ""] || "").trim() || null;
}

function createResolvedPreview(itemInput: ReturnType<typeof itemSchema.parse>, categories: Map<string, LookupRow>, types: Map<string, LookupRow>, locations: Map<string, LookupRow>, customFields: CustomFieldRow[], normalizedCustomValues: Array<{ customFieldId: string; valueJson: string }>) {
  return {
    name: itemInput.name,
    category: categories.get(itemInput.categoryId) || null,
    type: types.get(itemInput.typeId) || null,
    storageLocation: itemInput.storageLocationId ? locations.get(itemInput.storageLocationId) || null : null,
    unit: itemInput.unit,
    stock: serializeStoredQuantity(itemInput.unit, itemInput.stock) || 0,
    minStock: serializeStoredQuantity(itemInput.unit, itemInput.minStock),
    manufacturer: itemInput.manufacturer || null,
    mpn: itemInput.mpn || null,
    datasheetUrl: itemInput.datasheetUrl || null,
    purchaseUrl: itemInput.purchaseUrl || null,
    customFields: normalizedCustomValues
      .map((entry) => {
        const field = customFields.find((candidate) => candidate.id === entry.customFieldId);
        if (!field) return null;
        let parsedValue: unknown = entry.valueJson;
        try {
          parsedValue = JSON.parse(entry.valueJson);
        } catch {
          parsedValue = entry.valueJson;
        }
        return {
          customFieldId: entry.customFieldId,
          fieldName: field.name,
          displayValue: formatCustomFieldValue(field, parsedValue)
        };
      })
      .filter((entry): entry is ImportResolvedCustomFieldPreview => !!entry)
  };
}

function buildDuplicateWarnings(
  duplicateItems: DuplicateItemRecord[],
  candidate: {
    name: string;
    manufacturer?: string | null;
    mpn?: string | null;
    categoryId?: string | null;
    typeId?: string | null;
    unit?: string | null;
  }
) {
  const matches = findDuplicateCandidates(duplicateItems, candidate, { limit: 5 });
  if (!matches.length) return [] as ImportStructuredMessage[];
  return [
    {
      fieldKey: "duplicate",
      message: `Moegliche Duplikate: ${matches
        .map((entry) => `${entry.item.labelCode} (${entry.score}; ${entry.reasons.join("/")})`)
        .join(", ")}`
    }
  ];
}

function pickProfileMatches(profiles: ImportProfileRow[], headerFingerprint: string) {
  return profiles
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      description: profile.description || null,
      score: getImportProfileMatchScore(profile.headerFingerprint || null, headerFingerprint),
      delimiterMode: profile.delimiterMode
    }))
    .filter((profile) => profile.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "de"))
    .slice(0, 5);
}

export async function loadImportReferenceData(db: ImportDb) {
  const importProfileTable = (db as any).importProfile as {
    findMany: (args?: unknown) => Promise<ImportProfileRow[]>;
  };
  const [categories, types, locations, customFields, profiles, duplicateItems] = await Promise.all([
    db.category.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    db.labelType.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: [{ code: "asc" }, { name: "asc" }]
    }),
    db.storageLocation.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    db.customField.findMany({
      where: { isActive: true },
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
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    importProfileTable.findMany({
      orderBy: [{ name: "asc" }]
    }),
    db.item.findMany({
      where: {
        deletedAt: null,
        mergedIntoItemId: null
      },
      select: {
        id: true,
        labelCode: true,
        name: true,
        categoryId: true,
        typeId: true,
        unit: true,
        manufacturer: true,
        mpn: true,
        isArchived: true,
        deletedAt: true,
        mergedIntoItemId: true,
        mergedAt: true,
        category: {
          select: { id: true, name: true, code: true }
        },
        labelType: {
          select: { id: true, code: true, name: true }
        }
      }
    })
  ]);

  return { categories, types, locations, customFields, profiles, duplicateItems };
}

function buildHeaderPreview(headers: string[], mappingConfig: ImportProfileMappingConfig, suggestionConfig: ImportProfileMappingConfig) {
  const mappedByHeader = new Map<string, string[]>();
  const suggestedByHeader = new Map<string, string[]>();

  for (const assignment of mappingConfig.assignments) {
    if (assignment.sourceType !== "column" || !assignment.column) continue;
    mappedByHeader.set(assignment.column, [...(mappedByHeader.get(assignment.column) || []), assignment.targetKey]);
  }

  for (const assignment of suggestionConfig.assignments) {
    if (assignment.sourceType !== "column" || !assignment.column) continue;
    suggestedByHeader.set(assignment.column, [...(suggestedByHeader.get(assignment.column) || []), assignment.targetKey]);
  }

  return headers.map((header) => {
    const mappedTargetKeys = mappedByHeader.get(header) || [];
    const suggestedTargetKeys = suggestedByHeader.get(header) || [];
    const ignored = mappingConfig.assignments.some(
      (assignment) => assignment.sourceType === "ignore" && assignment.column === header
    );

    return {
      header,
      mappedTargetKeys,
      suggestedTargetKeys,
      status: mappedTargetKeys.length
        ? "mapped"
        : suggestedTargetKeys.length
          ? "suggested"
          : ignored
            ? "ignored"
            : "unmapped"
    } as ImportHeaderPreview;
  });
}

function collectMappingIssues(headers: string[], mappingConfig: ImportProfileMappingConfig, customFields: CustomFieldRow[]) {
  const headerSet = new Set(headers);
  const customFieldIds = new Set(customFields.map((field) => field.id));
  const issues: ImportMappingIssue[] = [];

  for (const assignment of mappingConfig.assignments) {
    if (assignment.sourceType === "column" && assignment.column && !headerSet.has(assignment.column)) {
      issues.push({
        fieldKey: assignment.targetKey,
        message: `Zuordnung verweist auf fehlende Spalte: ${assignment.column}`
      });
    }
    if (assignment.targetKey.startsWith("customField:")) {
      const fieldId = assignment.targetKey.slice("customField:".length);
      if (!customFieldIds.has(fieldId)) {
        issues.push({
          fieldKey: assignment.targetKey,
          message: "Zuordnung verweist auf ein fehlendes oder inaktives Custom Field"
        });
      }
    }
  }

  return issues;
}

export async function buildImportPreview(input: BuildPreviewInput): Promise<ImportPreviewResult> {
  const selectedProfile = hydrateImportProfile(
    (input.profiles || []).find((profile) => profile.id === input.selectedProfileId) || null
  );
  const parsedCsv = parseImportCsv(input.text, selectedProfile?.delimiterMode || "AUTO");
  const headers = parsedCsv.headers;
  const rows = parsedCsv.rows;
  const headerFingerprint = buildImportHeaderFingerprint(headers);
  const suggestionConfig = buildSuggestedImportMappingConfig(headers, input.customFields);

  const forcedTypeMapping = input.forcedTypeId
    ? {
        assignments: [
          {
            targetKey: "type",
            sourceType: "fixed" as const,
            fixedValue: input.forcedTypeId,
            column: null
          }
        ]
      }
    : null;

  const mappingConfig = mergeImportMappingConfigs(
    suggestionConfig,
    selectedProfile?.mappingConfig || null,
    forcedTypeMapping,
    parseImportProfileMappingConfig(input.mappingDraft || { assignments: [] })
  );

  const mappingIssues = collectMappingIssues(headers, mappingConfig, input.customFields);
  const profileMatches = pickProfileMatches(input.profiles || [], headerFingerprint);
  const headerPreview = buildHeaderPreview(headers, mappingConfig, suggestionConfig);
  const assignmentMap = buildAssignmentMap(mappingConfig);
  const categoryLookup = resolveLookupMaps(input.categories);
  const typeLookup = resolveLookupMaps(input.types);
  const locationLookup = resolveLookupMaps(input.locations);

  const preparedRows: PreparedImportRow[] = [];
  const responseRows: ImportPreviewRow[] = [];

  for (const [index, rawRow] of rows.entries()) {
    const lineNumber = index + 2;
    const errors: ImportStructuredMessage[] = [];
    const warnings: ImportStructuredMessage[] = [];

    const rawCategory = getAssignmentValue(assignmentMap.get("category"), rawRow);
    const rawType = getAssignmentValue(assignmentMap.get("type"), rawRow);
    const rawLocation = getAssignmentValue(assignmentMap.get("storageLocation"), rawRow);
    const resolvedCategory = rawCategory ? categoryLookup.byLookup.get(normalizeImportLookup(rawCategory)) || null : null;
    const resolvedType = rawType ? typeLookup.byLookup.get(normalizeImportLookup(rawType)) || null : null;
    const resolvedLocation = rawLocation ? locationLookup.byLookup.get(normalizeImportLookup(rawLocation)) || null : null;

    if (!rawCategory) errors.push({ fieldKey: "category", message: "Kategorie ist nicht zugeordnet" });
    else if (!resolvedCategory) errors.push({ fieldKey: "category", message: `Kategorie unbekannt: ${rawCategory}` });

    if (!rawType) errors.push({ fieldKey: "type", message: "Type ist nicht zugeordnet" });
    else if (!resolvedType) errors.push({ fieldKey: "type", message: `Type unbekannt: ${rawType}` });

    if (!rawLocation) errors.push({ fieldKey: "storageLocation", message: "Lagerort ist nicht zugeordnet" });
    else if (!resolvedLocation) errors.push({ fieldKey: "storageLocation", message: `Lagerort unbekannt: ${rawLocation}` });

    if (resolvedLocation && input.allowedLocationIds && !input.allowedLocationIds.includes(resolvedLocation.id)) {
      errors.push({ fieldKey: "storageLocation", message: "Lagerort nicht erlaubt" });
    }

    const applicableFields = filterApplicableCustomFields(
      input.customFields,
      resolvedCategory?.id || null,
      resolvedType?.id || null
    );

    const rawCustomValues: Record<string, unknown> = {};
    for (const assignment of mappingConfig.assignments) {
      if (!assignment.targetKey.startsWith("customField:")) continue;
      const fieldId = assignment.targetKey.slice("customField:".length);
      const rawValue = getAssignmentValue(assignment, rawRow);
      if (!rawValue) continue;

      const field = input.customFields.find((candidate) => candidate.id === fieldId);
      if (!field) continue;
      if (!fieldAppliesToSelection(field, resolvedCategory?.id || null, resolvedType?.id || null)) {
        warnings.push({
          fieldKey: assignment.targetKey,
          message: `${field.name} ist fuer diesen Kategorie-/Type-Scope nicht aktiv und wird ignoriert`
        });
        continue;
      }
      rawCustomValues[fieldId] = rawValue;
    }

    const candidateInput = {
      name: getAssignmentValue(assignmentMap.get("name"), rawRow) || "",
      description: getAssignmentValue(assignmentMap.get("description"), rawRow) || "",
      categoryId: resolvedCategory?.id || "",
      typeId: resolvedType?.id || "",
      storageLocationId: resolvedLocation?.id || "",
      storageArea: getAssignmentValue(assignmentMap.get("storageArea"), rawRow),
      bin: getAssignmentValue(assignmentMap.get("bin"), rawRow),
      unit: normalizeUnit(getAssignmentValue(assignmentMap.get("unit"), rawRow) || "STK"),
      stock: parseNumber(getAssignmentValue(assignmentMap.get("stock"), rawRow), 0),
      minStock: (() => {
        const rawValue = getAssignmentValue(assignmentMap.get("minStock"), rawRow);
        if (!rawValue) return null;
        return parseNumber(rawValue, 0);
      })(),
      manufacturer: getAssignmentValue(assignmentMap.get("manufacturer"), rawRow),
      mpn: getAssignmentValue(assignmentMap.get("mpn"), rawRow),
      datasheetUrl: getAssignmentValue(assignmentMap.get("datasheetUrl"), rawRow),
      purchaseUrl: getAssignmentValue(assignmentMap.get("purchaseUrl"), rawRow),
      tagIds: [],
      customValues: {}
    };

    let parsedItemInput: ReturnType<typeof itemSchema.parse> | null = null;
    const baseParsed = itemSchema.safeParse(candidateInput);
    if (!baseParsed.success) {
      for (const issue of baseParsed.error.issues) {
        errors.push({
          fieldKey: String(issue.path[0] || "row"),
          message: issue.message
        });
      }
    } else {
      try {
        parsedItemInput = {
          ...baseParsed.data,
          stock: toStoredQuantity(baseParsed.data.unit, baseParsed.data.stock, {
            field: "Bestand",
            allowNegative: false
          })!,
          minStock: toStoredQuantity(baseParsed.data.unit, baseParsed.data.minStock, {
            field: "Mindestbestand",
            allowNegative: false,
            nullable: true
          })
        };
      } catch (error) {
        if (error instanceof QuantityValidationError) {
          errors.push({ fieldKey: "stock", message: error.message });
        } else {
          throw error;
        }
      }
    }

    let normalizedCustomValues: Array<{ customFieldId: string; valueJson: string }> = [];
    if (parsedItemInput) {
      try {
        const preparedCustomValues = await prepareCustomFieldValueWrites(input.db, {
          rawValues: rawCustomValues,
          categoryId: parsedItemInput.categoryId,
          typeId: parsedItemInput.typeId
        });
        normalizedCustomValues = preparedCustomValues.upserts;
      } catch (error) {
        if (error instanceof CustomFieldValidationError) {
          errors.push({
            fieldKey: error.fieldId ? `customField:${error.fieldId}` : "customField",
            message: error.message
          });
        } else {
          throw error;
        }
      }
    }

    warnings.push(
      ...buildDuplicateWarnings(input.duplicateItems, {
        name: candidateInput.name,
        manufacturer: candidateInput.manufacturer,
        mpn: candidateInput.mpn,
        categoryId: resolvedCategory?.id || null,
        typeId: resolvedType?.id || null,
        unit: candidateInput.unit
      })
    );

    const responseRow: ImportPreviewRow = {
      lineNumber,
      status: errors.length ? "error" : "ready",
      input: rawRow,
      resolved:
        parsedItemInput && !errors.length
          ? createResolvedPreview(
              parsedItemInput,
              categoryLookup.byId,
              typeLookup.byId,
              locationLookup.byId,
              applicableFields,
              normalizedCustomValues
            )
          : null,
      errors,
      warnings
    };

    if (!errors.length && parsedItemInput) {
      preparedRows.push({
        lineNumber,
        itemInput: parsedItemInput,
        rawCustomValues,
        responseRow
      });
    }

    responseRows.push(responseRow);
  }

  return {
    delimiter: parsedCsv.delimiter,
    delimiterMode: parsedCsv.delimiterMode,
    headerFingerprint,
    headers: headerPreview,
    mappingConfig,
    mappingIssues,
    profileMatches,
    totalRows: rows.length,
    readyRowsCount: preparedRows.length,
    errorsCount: mappingIssues.length + responseRows.reduce((count, row) => count + row.errors.length, 0),
    warningsCount: responseRows.reduce((count, row) => count + row.warnings.length, 0),
    rows: responseRows,
    preparedRows
  };
}

export function serializeImportPreview(result: ImportPreviewResult) {
  return {
    delimiter: result.delimiter,
    delimiterMode: result.delimiterMode,
    headerFingerprint: result.headerFingerprint,
    headers: result.headers,
    mappingConfig: result.mappingConfig,
    mappingIssues: result.mappingIssues,
    profileMatches: result.profileMatches,
    totalRows: result.totalRows,
    readyRows: result.readyRowsCount,
    errorsCount: result.errorsCount,
    warningsCount: result.warningsCount,
    rows: result.rows
  };
}
