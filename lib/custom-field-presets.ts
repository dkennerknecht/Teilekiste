import type { CustomFieldCatalogEntry } from "@/lib/custom-fields";

export type CustomFieldPresetField = {
  key: string;
  name: string;
  type: "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "MULTI_SELECT" | "DATE";
  unit?: string | null;
  required?: boolean;
  sortOrder: number;
  valueCatalog?: CustomFieldCatalogEntry[];
};

export type CustomFieldPreset = {
  key: string;
  name: string;
  description: string;
  fields: CustomFieldPresetField[];
};

type TechnicalFieldPresetTable = {
  findMany?: (args?: any) => Promise<any[]>;
  findUnique?: (args: any) => Promise<any>;
  createMany?: (args: any) => Promise<unknown>;
  create?: (args: any) => Promise<unknown>;
  upsert?: (args: any) => Promise<unknown>;
};

type TechnicalFieldPresetDb = {
  technicalFieldPreset?: TechnicalFieldPresetTable;
};

function buildCatalog(values: Array<{ value: string; aliases?: string[] }>): CustomFieldCatalogEntry[] {
  return values.map((entry, index) => ({
    value: entry.value,
    aliases: entry.aliases || [],
    sortOrder: index
  }));
}

const commonColorCatalog = buildCatalog([
  { value: "Schwarz", aliases: ["schwarz", "black"] },
  { value: "Rot", aliases: ["rot", "red"] },
  { value: "Blau", aliases: ["blau", "blue"] },
  { value: "Gruen-Gelb", aliases: ["gruen gelb", "gruen-gelb", "green-yellow"] },
  { value: "Braun", aliases: ["braun", "brown"] },
  { value: "Grau", aliases: ["grau", "gray", "grey"] },
  { value: "Weiss", aliases: ["weiss", "white"] },
  { value: "Gelb", aliases: ["gelb", "yellow"] },
  { value: "Gruen", aliases: ["gruen", "green"] }
]);

export const customFieldPresets: CustomFieldPreset[] = [
  {
    key: "resistor",
    name: "Widerstand",
    description: "Wert, Toleranz, Leistung und Bauform fuer Widerstaende.",
    fields: [
      { key: "resistance-value", name: "Wert", type: "TEXT", sortOrder: 10 },
      {
        key: "tolerance",
        name: "Toleranz",
        type: "SELECT",
        sortOrder: 20,
        valueCatalog: buildCatalog([{ value: "0.1%" }, { value: "0.5%" }, { value: "1%" }, { value: "5%" }, { value: "10%" }])
      },
      { key: "power-rating", name: "Leistung", type: "TEXT", unit: "W", sortOrder: 30 },
      {
        key: "package",
        name: "Bauform",
        type: "SELECT",
        sortOrder: 40,
        valueCatalog: buildCatalog([{ value: "0603" }, { value: "0805" }, { value: "1206" }, { value: "THT" }])
      }
    ]
  },
  {
    key: "capacitor",
    name: "Kondensator",
    description: "Kapazitaet, Spannung, Dielektrikum und Bauform fuer Kondensatoren.",
    fields: [
      { key: "capacitance", name: "Kapazitaet", type: "TEXT", unit: "F", sortOrder: 10 },
      { key: "voltage-rating", name: "Spannung", type: "TEXT", unit: "V", sortOrder: 20 },
      {
        key: "dielectric",
        name: "Dielektrikum",
        type: "SELECT",
        sortOrder: 30,
        valueCatalog: buildCatalog([
          { value: "X5R" },
          { value: "X7R" },
          { value: "C0G", aliases: ["NP0"] },
          { value: "Elektrolyt", aliases: ["Elko"] },
          { value: "Tantal" }
        ])
      },
      {
        key: "package",
        name: "Bauform",
        type: "SELECT",
        sortOrder: 40,
        valueCatalog: buildCatalog([{ value: "0603" }, { value: "0805" }, { value: "1206" }, { value: "Radial" }])
      }
    ]
  },
  {
    key: "temperature-sensor",
    name: "Temperatursensor",
    description: "Interface, Messbereich und Versorgung fuer Temperatursensoren.",
    fields: [
      {
        key: "interface",
        name: "Interface",
        type: "SELECT",
        sortOrder: 10,
        valueCatalog: buildCatalog([{ value: "1-Wire" }, { value: "I2C" }, { value: "SPI" }, { value: "Analog" }])
      },
      { key: "measurement-range", name: "Messbereich", type: "TEXT", unit: "degC", sortOrder: 20 },
      { key: "supply-voltage", name: "Versorgung", type: "TEXT", unit: "V", sortOrder: 30 }
    ]
  },
  {
    key: "relay-contactor",
    name: "Relais / Schuetz",
    description: "Spulenspannung, Kontaktart und Schaltstrom fuer Relais oder Schuetze.",
    fields: [
      { key: "coil-voltage", name: "Spulenspannung", type: "TEXT", unit: "V", sortOrder: 10 },
      {
        key: "coil-type",
        name: "Spulenart",
        type: "SELECT",
        sortOrder: 15,
        valueCatalog: buildCatalog([{ value: "AC" }, { value: "DC" }, { value: "UC", aliases: ["AC/DC"] }])
      },
      {
        key: "contact-type",
        name: "Kontaktart",
        type: "SELECT",
        sortOrder: 20,
        valueCatalog: buildCatalog([
          { value: "NO", aliases: ["Schliesser"] },
          { value: "NC", aliases: ["Oeffner"] },
          { value: "Wechsler", aliases: ["CO"] }
        ])
      },
      { key: "pole-count", name: "Polzahl", type: "NUMBER", sortOrder: 30 },
      { key: "switching-current", name: "Schaltstrom", type: "TEXT", unit: "A", sortOrder: 40 },
      {
        key: "mounting",
        name: "Montage",
        type: "SELECT",
        sortOrder: 50,
        valueCatalog: buildCatalog([{ value: "DIN-Schiene" }, { value: "Stecksockel" }, { value: "PCB" }, { value: "Flansch" }])
      }
    ]
  },
  {
    key: "cable-wire",
    name: "Kabel / Litze / Ader",
    description: "Querschnitt, Aderzahl, Leiterart, Farbe und Rollenlaenge fuer Kabel, Litze oder Einzeladern.",
    fields: [
      { key: "cross-section", name: "Querschnitt", type: "TEXT", unit: "mm2", sortOrder: 10 },
      { key: "conductor-count", name: "Aderzahl", type: "NUMBER", sortOrder: 20 },
      {
        key: "conductor-class",
        name: "Leiterart",
        type: "SELECT",
        sortOrder: 25,
        valueCatalog: buildCatalog([
          { value: "Eindraehtig", aliases: ["starr", "solid"] },
          { value: "Mehrdraehtig", aliases: ["stranded"] },
          { value: "Feindraehtig", aliases: ["flexibel", "fine stranded"] }
        ])
      },
      {
        key: "color",
        name: "Farbe",
        type: "TEXT",
        sortOrder: 30,
        valueCatalog: commonColorCatalog
      },
      {
        key: "insulation",
        name: "Isolation",
        type: "SELECT",
        sortOrder: 40,
        valueCatalog: buildCatalog([{ value: "PVC" }, { value: "Silikon" }, { value: "PE" }, { value: "TPE" }, { value: "XLPE" }])
      },
      { key: "roll-length", name: "Rollenlaenge", type: "TEXT", unit: "m", sortOrder: 50 }
    ]
  },
  {
    key: "fuse-circuit-breaker",
    name: "Sicherung / Leitungsschutzschalter",
    description: "Bauart, Nennstrom, Charakteristik und Polzahl fuer Sicherungen oder Leitungsschutzschalter.",
    fields: [
      {
        key: "device-kind",
        name: "Bauart",
        type: "SELECT",
        sortOrder: 10,
        valueCatalog: buildCatalog([
          { value: "Leitungsschutzschalter", aliases: ["LS", "MCB"] },
          { value: "Schmelzsicherung", aliases: ["Fuse"] },
          { value: "Neozed" },
          { value: "Diazed" },
          { value: "NH" }
        ])
      },
      { key: "rated-current", name: "Nennstrom", type: "TEXT", unit: "A", sortOrder: 20 },
      {
        key: "trip-curve",
        name: "Charakteristik",
        type: "SELECT",
        sortOrder: 30,
        valueCatalog: buildCatalog([
          { value: "B" },
          { value: "C" },
          { value: "D" },
          { value: "gG" },
          { value: "aM" }
        ])
      },
      { key: "pole-count", name: "Polzahl", type: "NUMBER", sortOrder: 40 },
      { key: "breaking-capacity", name: "Schaltvermoegen", type: "TEXT", unit: "kA", sortOrder: 50 },
      { key: "voltage-rating", name: "Nennspannung", type: "TEXT", unit: "V", sortOrder: 60 }
    ]
  },
  {
    key: "rcd",
    name: "FI / RCD",
    description: "Fehlerstrom, Nennstrom, Typ und Polzahl fuer FI-Schutzschalter.",
    fields: [
      { key: "rated-current", name: "Nennstrom", type: "TEXT", unit: "A", sortOrder: 10 },
      { key: "residual-current", name: "Fehlerstrom", type: "TEXT", unit: "mA", sortOrder: 20 },
      {
        key: "rcd-type",
        name: "RCD-Typ",
        type: "SELECT",
        sortOrder: 30,
        valueCatalog: buildCatalog([{ value: "AC" }, { value: "A" }, { value: "F" }, { value: "B" }])
      },
      { key: "pole-count", name: "Polzahl", type: "NUMBER", sortOrder: 40 },
      { key: "breaking-capacity", name: "Kurzschlussfestigkeit", type: "TEXT", unit: "kA", sortOrder: 50 }
    ]
  },
  {
    key: "terminal-block",
    name: "Wago / Verbindungsklemme",
    description: "Serie, Klemmtyp, Polzahl und Leiterbereich fuer Wago- oder andere Verbindungsklemmen.",
    fields: [
      { key: "series", name: "Serie", type: "TEXT", sortOrder: 10 },
      {
        key: "terminal-kind",
        name: "Klemmtyp",
        type: "SELECT",
        sortOrder: 20,
        valueCatalog: buildCatalog([
          { value: "Hebelklemme" },
          { value: "Steckklemme" },
          { value: "Reihenklemme" },
          { value: "Luesterklemme" }
        ])
      },
      { key: "pole-count", name: "Polzahl", type: "NUMBER", sortOrder: 30 },
      { key: "conductor-range", name: "Leiterbereich", type: "TEXT", unit: "mm2", sortOrder: 40 },
      {
        key: "mounting",
        name: "Montage",
        type: "SELECT",
        sortOrder: 50,
        valueCatalog: buildCatalog([{ value: "Freiverdrahtung" }, { value: "DIN-Schiene" }, { value: "PCB" }])
      },
      {
        key: "color",
        name: "Farbe",
        type: "TEXT",
        sortOrder: 60,
        valueCatalog: commonColorCatalog
      }
    ]
  },
  {
    key: "voltage-converter",
    name: "Spannungswandler / Netzteilmodul",
    description: "Topologie, Eingangs-/Ausgangsspannung und Strom fuer Spannungswandler oder Netzteilmodule.",
    fields: [
      {
        key: "topology",
        name: "Topologie",
        type: "SELECT",
        sortOrder: 10,
        valueCatalog: buildCatalog([
          { value: "Linear" },
          { value: "Buck" },
          { value: "Boost" },
          { value: "Buck-Boost" },
          { value: "AC-DC" },
          { value: "Isolated DC-DC", aliases: ["isolated"] }
        ])
      },
      { key: "input-voltage", name: "Eingangsspannung", type: "TEXT", unit: "V", sortOrder: 20 },
      { key: "output-voltage", name: "Ausgangsspannung", type: "TEXT", unit: "V", sortOrder: 30 },
      { key: "output-current", name: "Ausgangsstrom", type: "TEXT", unit: "A", sortOrder: 40 },
      { key: "isolated", name: "Galvanisch getrennt", type: "BOOLEAN", sortOrder: 50 },
      {
        key: "package",
        name: "Bauform",
        type: "SELECT",
        sortOrder: 60,
        valueCatalog: buildCatalog([{ value: "Modul" }, { value: "TO-220" }, { value: "SOT-223" }, { value: "TO-263" }])
      }
    ]
  },
  {
    key: "connector",
    name: "Steckverbinder",
    description: "Serie, Polzahl, Rastermass, Geschlecht und Montage fuer Steckverbinder.",
    fields: [
      { key: "series", name: "Serie", type: "TEXT", sortOrder: 10 },
      { key: "pole-count", name: "Polzahl", type: "NUMBER", sortOrder: 20 },
      { key: "pitch", name: "Rastermass", type: "TEXT", unit: "mm", sortOrder: 30 },
      {
        key: "gender",
        name: "Ausfuehrung",
        type: "SELECT",
        sortOrder: 40,
        valueCatalog: buildCatalog([
          { value: "Male", aliases: ["Stecker", "Header"] },
          { value: "Female", aliases: ["Buchse", "Receptacle"] },
          { value: "Pair", aliases: ["Set"] }
        ])
      },
      {
        key: "mounting",
        name: "Montage",
        type: "SELECT",
        sortOrder: 50,
        valueCatalog: buildCatalog([{ value: "THT" }, { value: "SMD" }, { value: "Panel" }, { value: "Kabel" }])
      },
      { key: "coding", name: "Kodierung", type: "TEXT", sortOrder: 60 }
    ]
  }
];

export function getCustomFieldPreset(presetKey: string) {
  return customFieldPresets.find((preset) => preset.key === presetKey) || null;
}

function normalizePresetField(field: CustomFieldPresetField, index: number): CustomFieldPresetField {
  return {
    key: String(field.key || "").trim(),
    name: String(field.name || "").trim(),
    type: field.type,
    unit: field.unit?.trim() || null,
    required: !!field.required,
    sortOrder: Number.isFinite(field.sortOrder) ? field.sortOrder : index,
    valueCatalog: field.valueCatalog?.map((entry, catalogIndex) => ({
      value: String(entry.value || "").trim(),
      aliases: (entry.aliases || []).map((alias) => String(alias || "").trim()).filter(Boolean),
      sortOrder: Number.isFinite(entry.sortOrder) ? entry.sortOrder : catalogIndex
    }))?.filter((entry) => entry.value) || []
  };
}

function normalizePreset(preset: CustomFieldPreset): CustomFieldPreset {
  return {
    key: String(preset.key || "").trim(),
    name: String(preset.name || "").trim(),
    description: String(preset.description || "").trim(),
    fields: (preset.fields || [])
      .map((field, index) => normalizePresetField(field, index))
      .filter((field) => field.key && field.name)
  };
}

export function serializeTechnicalFieldPresetFields(fields: CustomFieldPresetField[]) {
  return JSON.stringify((fields || []).map((field, index) => normalizePresetField(field, index)));
}

export function parseTechnicalFieldPresetFields(value: unknown): CustomFieldPresetField[] {
  if (!value) return [];
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((field, index) => normalizePresetField(field as CustomFieldPresetField, index))
    .filter((field) => field.key && field.name);
}

function getTechnicalFieldPresetTable(db: TechnicalFieldPresetDb | null | undefined) {
  return (db as any)?.technicalFieldPreset as TechnicalFieldPresetTable | undefined;
}

export async function ensureTechnicalFieldPresets(db: TechnicalFieldPresetDb | null | undefined) {
  const presetTable = getTechnicalFieldPresetTable(db);
  if (!presetTable?.findMany) return customFieldPresets;

  const existing = await presetTable.findMany({ select: { key: true } });
  const existingKeys = new Set((existing || []).map((row: any) => row.key));
  const missingPresets = customFieldPresets
    .map((preset) => normalizePreset(preset))
    .filter((preset) => !existingKeys.has(preset.key));

  if (!missingPresets.length) return listTechnicalFieldPresets(db);

  const rows = missingPresets.map((preset) => ({
    key: preset.key,
    name: preset.name,
    description: preset.description,
    fieldsJson: serializeTechnicalFieldPresetFields(preset.fields)
  }));

  if (presetTable.createMany) {
    await presetTable.createMany({
      data: rows
    });
  } else if (presetTable.upsert) {
    for (const row of rows) {
      await presetTable.upsert({
        where: { key: row.key },
        update: {},
        create: row
      });
    }
  } else if (presetTable.create) {
    for (const row of rows) {
      await presetTable.create({ data: row });
    }
  }

  return listTechnicalFieldPresets(db);
}

export async function listTechnicalFieldPresets(db: TechnicalFieldPresetDb | null | undefined) {
  const presetTable = getTechnicalFieldPresetTable(db);
  if (!presetTable?.findMany) {
    return customFieldPresets.map((preset) => normalizePreset(preset));
  }

  const existing = await presetTable.findMany({ select: { key: true } });
  const existingKeys = new Set((existing || []).map((row: any) => row.key));
  const missingPresets = customFieldPresets
    .map((preset) => normalizePreset(preset))
    .filter((preset) => !existingKeys.has(preset.key));

  if (missingPresets.length) {
    await ensureTechnicalFieldPresets(db);
  }

  const rows = await presetTable.findMany({
    orderBy: [{ name: "asc" }, { key: "asc" }]
  });

  return (rows || []).map((row: any) =>
    normalizePreset({
      key: row.key,
      name: row.name,
      description: row.description || "",
      fields: parseTechnicalFieldPresetFields(row.fieldsJson)
    })
  );
}

export async function getStoredTechnicalFieldPreset(
  db: TechnicalFieldPresetDb | null | undefined,
  presetKey: string
) {
  const presetTable = getTechnicalFieldPresetTable(db);
  if (!presetTable?.findUnique) return getCustomFieldPreset(presetKey);

  await ensureTechnicalFieldPresets(db);
  const row = await presetTable.findUnique({
    where: { key: presetKey }
  });
  if (!row) return null;

  return normalizePreset({
    key: row.key,
    name: row.name,
    description: row.description || "",
    fields: parseTechnicalFieldPresetFields(row.fieldsJson)
  });
}
