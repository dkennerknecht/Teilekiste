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

function buildCatalog(values: Array<{ value: string; aliases?: string[] }>): CustomFieldCatalogEntry[] {
  return values.map((entry, index) => ({
    value: entry.value,
    aliases: entry.aliases || [],
    sortOrder: index
  }));
}

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
      { key: "switching-current", name: "Schaltstrom", type: "TEXT", unit: "A", sortOrder: 30 }
    ]
  },
  {
    key: "cable-wire",
    name: "Kabel / Litze",
    description: "Querschnitt, Aderzahl, Farbe und Rollenlaenge fuer Kabel oder Litze.",
    fields: [
      { key: "cross-section", name: "Querschnitt", type: "TEXT", unit: "mm2", sortOrder: 10 },
      { key: "conductor-count", name: "Aderzahl", type: "NUMBER", sortOrder: 20 },
      {
        key: "color",
        name: "Farbe",
        type: "TEXT",
        sortOrder: 30,
        valueCatalog: buildCatalog([
          { value: "Schwarz", aliases: ["schwarz", "black"] },
          { value: "Rot", aliases: ["rot", "red"] },
          { value: "Blau", aliases: ["blau", "blue"] },
          { value: "Gruen-Gelb", aliases: ["gruen gelb", "gruen-gelb", "green-yellow"] },
          { value: "Braun", aliases: ["braun", "brown"] }
        ])
      },
      { key: "roll-length", name: "Rollenlaenge", type: "TEXT", unit: "m", sortOrder: 40 }
    ]
  }
];

export function getCustomFieldPreset(presetKey: string) {
  return customFieldPresets.find((preset) => preset.key === presetKey) || null;
}
