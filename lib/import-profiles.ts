import { parse } from "csv-parse/sync";
import { importProfileMappingConfigSchema } from "@/lib/validation";
import type { CustomFieldRow } from "@/lib/custom-fields";

export const importDelimiterModes = ["AUTO", "COMMA", "SEMICOLON", "TAB"] as const;
export type ImportDelimiterMode = (typeof importDelimiterModes)[number];
export type ImportProfileMappingConfig = ReturnType<typeof importProfileMappingConfigSchema.parse>;
export type ImportProfileAssignment = ImportProfileMappingConfig["assignments"][number];

export type ImportProfileRow = {
  id: string;
  name: string;
  description?: string | null;
  headerFingerprint?: string | null;
  delimiterMode: string;
  mappingConfig: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export const importCoreTargets = [
  { key: "category", label: "Kategorie" },
  { key: "type", label: "Type" },
  { key: "storageLocation", label: "Lagerort" },
  { key: "name", label: "Name" },
  { key: "description", label: "Beschreibung" },
  { key: "storageArea", label: "Bereich" },
  { key: "bin", label: "Fach" },
  { key: "stock", label: "Bestand" },
  { key: "minStock", label: "Mindestbestand" },
  { key: "unit", label: "Einheit" },
  { key: "manufacturer", label: "Hersteller" },
  { key: "mpn", label: "MPN" },
  { key: "datasheetUrl", label: "Datenblatt-URL" },
  { key: "purchaseUrl", label: "Kauf-URL" }
] as const;

const importCoreFieldAliases: Record<string, string[]> = {
  category: ["category", "kategorie", "warengruppe"],
  type: ["type", "typ", "labeltype", "artikeltyp"],
  storageLocation: ["storagelocation", "lagerort", "lager", "location"],
  name: ["name", "artikel", "bezeichnung", "titel"],
  description: ["description", "beschreibung", "details"],
  storageArea: ["storagearea", "lagerbereich", "bereich", "fachbereich"],
  bin: ["bin", "fach", "platz", "box"],
  stock: ["stock", "bestand", "qty", "quantity", "menge"],
  minStock: ["minstock", "mindestbestand", "minimum", "meldebestand"],
  unit: ["unit", "einheit", "uom"],
  manufacturer: ["manufacturer", "hersteller", "brand", "marke"],
  mpn: ["mpn", "partnumber", "part number", "manufacturerpartnumber", "artikelnummer"],
  datasheetUrl: ["datasheeturl", "datenblatt", "datenblatturl", "datasheet"],
  purchaseUrl: ["purchaseurl", "kaufurl", "shopurl", "bestellurl", "produkturl"]
};

function normalizeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

export function normalizeImportLookup(value: string | null | undefined) {
  return normalizeAscii(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedHeaderFingerprintEntries(headers: string[]) {
  return headers
    .map((header) => normalizeImportLookup(header))
    .filter(Boolean);
}

export function buildImportHeaderFingerprint(headers: string[]) {
  return normalizedHeaderFingerprintEntries(headers).join("|");
}

export function parseImportProfileMappingConfig(input: unknown): ImportProfileMappingConfig {
  if (typeof input === "string") {
    try {
      return importProfileMappingConfigSchema.parse(JSON.parse(input));
    } catch {
      return importProfileMappingConfigSchema.parse({ assignments: [] });
    }
  }

  return importProfileMappingConfigSchema.parse(input || { assignments: [] });
}

export function serializeImportProfileMappingConfig(config: ImportProfileMappingConfig) {
  return JSON.stringify(importProfileMappingConfigSchema.parse(config || { assignments: [] }));
}

export function sortImportAssignments(assignments: ImportProfileAssignment[]) {
  return [...assignments].sort(
    (left, right) =>
      left.targetKey.localeCompare(right.targetKey, "de") ||
      String(left.column || "").localeCompare(String(right.column || ""), "de")
  );
}

export function mergeImportMappingConfigs(...configs: Array<ImportProfileMappingConfig | null | undefined>): ImportProfileMappingConfig {
  const merged = new Map<string, ImportProfileAssignment>();

  for (const config of configs) {
    const parsed = parseImportProfileMappingConfig(config || { assignments: [] });
    for (const assignment of parsed.assignments) {
      merged.set(assignment.targetKey, assignment);
    }
  }

  return {
    assignments: sortImportAssignments(Array.from(merged.values()))
  };
}

function buildCustomFieldHeaderMaps(customFields: CustomFieldRow[]) {
  const byKey = new Map<string, string>();
  const nameCounts = new Map<string, number>();

  for (const field of customFields) {
    const normalizedKey = normalizeImportLookup(field.key);
    if (normalizedKey) byKey.set(normalizedKey, field.id);
    const normalizedName = normalizeImportLookup(field.name);
    if (normalizedName) {
      nameCounts.set(normalizedName, (nameCounts.get(normalizedName) || 0) + 1);
    }
  }

  const byUniqueName = new Map<string, string>();
  for (const field of customFields) {
    const normalizedName = normalizeImportLookup(field.name);
    if (normalizedName && nameCounts.get(normalizedName) === 1) {
      byUniqueName.set(normalizedName, field.id);
    }
  }

  return { byKey, byUniqueName };
}

function buildSuggestedAssignment(header: string, customFields: CustomFieldRow[]) {
  const normalizedHeader = normalizeImportLookup(header);
  if (!normalizedHeader) return null;

  for (const [targetKey, aliases] of Object.entries(importCoreFieldAliases)) {
    if (aliases.some((alias) => normalizeImportLookup(alias) === normalizedHeader)) {
      return {
        targetKey,
        sourceType: "column" as const,
        column: header,
        fixedValue: null
      };
    }
  }

  const { byKey, byUniqueName } = buildCustomFieldHeaderMaps(customFields);
  const fieldId = byKey.get(normalizedHeader) || byUniqueName.get(normalizedHeader);
  if (!fieldId) return null;

  return {
    targetKey: `customField:${fieldId}`,
    sourceType: "column" as const,
    column: header,
    fixedValue: null
  };
}

export function buildSuggestedImportMappingConfig(headers: string[], customFields: CustomFieldRow[]) {
  const assignments = new Map<string, ImportProfileAssignment>();

  for (const header of headers) {
    const assignment = buildSuggestedAssignment(header, customFields);
    if (!assignment) continue;
    if (!assignments.has(assignment.targetKey)) {
      assignments.set(assignment.targetKey, assignment);
    }
  }

  return {
    assignments: sortImportAssignments(Array.from(assignments.values()))
  };
}

function getDelimiterCharacter(mode: ImportDelimiterMode) {
  switch (mode) {
    case "COMMA":
      return ",";
    case "SEMICOLON":
      return ";";
    case "TAB":
      return "\t";
    case "AUTO":
    default:
      return null;
  }
}

function scoreDelimiter(text: string, delimiter: "," | ";" | "\t") {
  try {
    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      delimiter,
      relax_column_count: true
    }) as Record<string, string>[];
    const headers = Object.keys(rows[0] || {});
    const nonEmptyHeaders = headers.filter((header) => header.trim().length > 0);

    return {
      delimiter,
      rows,
      headers,
      score: rows.length * 10 + nonEmptyHeaders.length * 3 + (headers.length > 1 ? 15 : 0)
    };
  } catch {
    return {
      delimiter,
      rows: [] as Record<string, string>[],
      headers: [] as string[],
      score: -1
    };
  }
}

export function parseImportCsv(text: string, mode: ImportDelimiterMode = "AUTO") {
  const forcedDelimiter = getDelimiterCharacter(mode);
  const candidates = forcedDelimiter ? [forcedDelimiter] : [",", ";", "\t"];
  const scored = candidates.map((delimiter) => scoreDelimiter(text, delimiter as "," | ";" | "\t"));
  const best = scored.sort((left, right) => right.score - left.score)[0];

  if (!best || best.score < 0) {
    return {
      delimiterMode: mode,
      delimiter: forcedDelimiter || ",",
      headers: [] as string[],
      rows: [] as Record<string, string>[]
    };
  }

  const resolvedMode: ImportDelimiterMode =
    best.delimiter === ","
      ? "COMMA"
      : best.delimiter === ";"
        ? "SEMICOLON"
        : "TAB";

  return {
    delimiterMode: forcedDelimiter ? mode : resolvedMode,
    delimiter: best.delimiter,
    headers: best.headers,
    rows: best.rows
  };
}

export function getImportProfileMatchScore(profileFingerprint: string | null | undefined, headerFingerprint: string) {
  if (!profileFingerprint || !headerFingerprint) return 0;
  if (profileFingerprint === headerFingerprint) return 100;

  const profileHeaders = new Set(profileFingerprint.split("|").filter(Boolean));
  const currentHeaders = new Set(headerFingerprint.split("|").filter(Boolean));
  if (!profileHeaders.size || !currentHeaders.size) return 0;

  let overlap = 0;
  for (const header of profileHeaders) {
    if (currentHeaders.has(header)) overlap += 1;
  }

  return Math.round((overlap / Math.max(profileHeaders.size, currentHeaders.size)) * 100);
}

export function hydrateImportProfile(profile: ImportProfileRow | null | undefined) {
  if (!profile) return null;
  return {
    ...profile,
    delimiterMode: importDelimiterModes.includes(profile.delimiterMode as ImportDelimiterMode)
      ? (profile.delimiterMode as ImportDelimiterMode)
      : "AUTO",
    mappingConfig: parseImportProfileMappingConfig(profile.mappingConfig)
  };
}
