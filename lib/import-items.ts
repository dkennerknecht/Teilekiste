import { z } from "zod";
import type { CustomFieldRow } from "@/lib/custom-fields";
import { filterApplicableCustomFields } from "@/lib/custom-fields";

const csvRowSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().max(8000).default(""),
  storageArea: z.string().max(120).optional().nullable(),
  bin: z.string().max(120).optional().nullable(),
  stock: z.number().int(),
  minStock: z.number().int().nullable(),
  unit: z.enum(["STK", "M", "SET", "PACK"]),
  manufacturer: z.string().max(180).optional().nullable(),
  mpn: z.string().max(180).optional().nullable()
});

export type ImportReadyRow = {
  lineNumber: number;
  input: z.infer<typeof csvRowSchema> & {
    categoryId: string;
    storageLocationId: string;
    customValues: Record<string, unknown>;
  };
  warnings: string[];
};

export type ImportAnalyzedRow = {
  lineNumber: number;
  status: "ready" | "error";
  input: (ImportReadyRow["input"] & { categoryName: string; locationName: string }) | null;
  errors: string[];
  warnings: string[];
};

function parseInteger(value: string | undefined, fallback = 0) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return Number.NaN;
  return Math.trunc(num);
}

function normalizeImportLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzeImportRows(input: {
  rows: Record<string, string>[];
  categoryMap: Map<string, string>;
  locationMap: Map<string, string>;
  allowedLocationIds: string[] | null;
  duplicateCandidatesByKey: Map<string, Array<{ id: string; labelCode: string; name: string }>>;
  customFields: CustomFieldRow[];
  typeId?: string | null;
}) {
  const seenNames = new Map<string, number>();
  const seenMpns = new Map<string, number>();

  const analyzedRows: ImportAnalyzedRow[] = input.rows.map((row, idx) => {
    const lineNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const categoryName = String(row.category || "").trim();
    const locationName = String(row.storageLocation || "").trim();
    const categoryId = input.categoryMap.get(categoryName.toLowerCase());
    const storageLocationId = input.locationMap.get(locationName.toLowerCase());

    if (!categoryId) errors.push("Kategorie unbekannt");
    if (!storageLocationId) errors.push("Lagerort unbekannt");
    if (storageLocationId && input.allowedLocationIds && !input.allowedLocationIds.includes(storageLocationId)) {
      errors.push("Lagerort nicht erlaubt");
    }

    const stock = parseInteger(row.stock, 0);
    const minStockRaw = String(row.minStock || "").trim();
    const minStock = minStockRaw ? parseInteger(minStockRaw, 0) : null;
    const candidate = {
      name: String(row.name || "").trim(),
      description: String(row.description || "").trim(),
      storageArea: String(row.storageArea || "").trim() || null,
      bin: String(row.bin || "").trim() || null,
      stock,
      minStock,
      unit: String(row.unit || "STK").trim().toUpperCase(),
      manufacturer: String(row.manufacturer || "").trim() || null,
      mpn: String(row.mpn || "").trim() || null
    };

    const parsed = csvRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((issue) => issue.path.join(".") || issue.message));
    }
    const normalizedInput =
      parsed.success && categoryId && storageLocationId
        ? {
            ...parsed.data,
            categoryId,
            storageLocationId,
            customValues: Object.fromEntries(
              (() => {
                const applicableFields = filterApplicableCustomFields(input.customFields, categoryId, input.typeId || null);
                const byKey = new Map(applicableFields.map((field) => [normalizeImportLookup(field.key), field]));
                const nameCounts = new Map<string, number>();
                for (const field of applicableFields) {
                  const normalizedName = normalizeImportLookup(field.name);
                  nameCounts.set(normalizedName, (nameCounts.get(normalizedName) || 0) + 1);
                }
                const byName = new Map(
                  applicableFields
                    .filter((field) => nameCounts.get(normalizeImportLookup(field.name)) === 1)
                    .map((field) => [normalizeImportLookup(field.name), field])
                );

                return Object.entries(row)
                  .map(([header, rawValue]) => {
                    const normalizedHeader = normalizeImportLookup(header);
                    const field = byKey.get(normalizedHeader) || byName.get(normalizedHeader);
                    const value = String(rawValue || "").trim();
                    if (!field || !value) return null;
                    return [field.id, value] as const;
                  })
                  .filter((entry): entry is readonly [string, string] => !!entry);
              })()
            ),
            categoryName,
            locationName
          }
        : null;

    const normalizedName = candidate.name.toLowerCase();
    const normalizedMpn = (candidate.mpn || "").toLowerCase();

    if (normalizedName) {
      if (seenNames.has(normalizedName)) warnings.push(`Name bereits in CSV, zuerst in Zeile ${seenNames.get(normalizedName)}`);
      else seenNames.set(normalizedName, lineNumber);
    }
    if (normalizedMpn) {
      if (seenMpns.has(normalizedMpn)) warnings.push(`MPN bereits in CSV, zuerst in Zeile ${seenMpns.get(normalizedMpn)}`);
      else seenMpns.set(normalizedMpn, lineNumber);
    }

    const duplicateKeys = [normalizedName, normalizedMpn].filter(Boolean);
    const duplicateCandidates = duplicateKeys.flatMap((key) => input.duplicateCandidatesByKey.get(key) || []);
    if (duplicateCandidates.length) {
      warnings.push(
        `Mögliche Duplikate vorhanden: ${Array.from(new Set(duplicateCandidates.map((entry) => entry.labelCode))).join(", ")}`
      );
    }

    if (errors.length || !parsed.success || !categoryId || !storageLocationId) {
      return {
        lineNumber,
        status: "error" as const,
        input: normalizedInput,
        errors,
        warnings
      };
    }

    return {
      lineNumber,
      status: "ready" as const,
      input: normalizedInput,
      errors,
      warnings
    };
  });

  return {
    analyzedRows,
    readyRows: analyzedRows
      .filter((row): row is ImportAnalyzedRow & { input: NonNullable<ImportAnalyzedRow["input"]> } => row.status === "ready" && !!row.input)
      .map((row) => ({
        lineNumber: row.lineNumber,
        input: {
          ...row.input,
          categoryId: row.input.categoryId,
          storageLocationId: row.input.storageLocationId
        },
        warnings: row.warnings
      })) as ImportReadyRow[],
    errorsCount: analyzedRows.reduce((count, row) => count + row.errors.length, 0),
    warningsCount: analyzedRows.reduce((count, row) => count + row.warnings.length, 0)
  };
}
