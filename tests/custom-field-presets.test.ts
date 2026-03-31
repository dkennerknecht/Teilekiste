import { describe, expect, it, vi } from "vitest";
import {
  customFieldPresets,
  getCustomFieldPreset,
  getStoredTechnicalFieldPreset,
  parseTechnicalFieldPresetFields,
  serializeTechnicalFieldPresetFields
} from "@/lib/custom-field-presets";

describe("custom field presets", () => {
  it("includes common electrical installation presets", () => {
    expect(getCustomFieldPreset("fuse-circuit-breaker")?.name).toBe("Sicherung / Leitungsschutzschalter");
    expect(getCustomFieldPreset("rcd")?.name).toBe("FI / RCD");
    expect(getCustomFieldPreset("terminal-block")?.name).toBe("Wago / Verbindungsklemme");
  });

  it("includes common electronics presets", () => {
    expect(getCustomFieldPreset("voltage-converter")?.name).toBe("Spannungswandler / Netzteilmodul");
    expect(getCustomFieldPreset("connector")?.name).toBe("Steckverbinder");
  });

  it("keeps preset field keys stable enough for managed sync", () => {
    const relayPreset = getCustomFieldPreset("relay-contactor");
    expect(relayPreset?.fields.some((field) => field.key === "coil-voltage")).toBe(true);
    expect(relayPreset?.fields.some((field) => field.key === "pole-count")).toBe(true);

    const cablePreset = getCustomFieldPreset("cable-wire");
    expect(cablePreset?.fields.some((field) => field.key === "cross-section")).toBe(true);
    expect(cablePreset?.fields.some((field) => field.key === "conductor-class")).toBe(true);

    expect(customFieldPresets.length).toBeGreaterThanOrEqual(8);
  });

  it("roundtrips editable preset field definitions", () => {
    const fields = [
      {
        key: "rated-current",
        name: "Nennstrom",
        type: "TEXT" as const,
        unit: "A",
        required: true,
        sortOrder: 10,
        valueCatalog: [
          {
            value: "16A",
            aliases: ["16 A"],
            sortOrder: 0
          }
        ]
      }
    ];

    expect(parseTechnicalFieldPresetFields(serializeTechnicalFieldPresetFields(fields))).toEqual(fields);
  });

  it("loads stored technical presets from editable preset storage", async () => {
    const findMany = vi.fn().mockResolvedValue(customFieldPresets.map((preset) => ({ key: preset.key })));
    const findUnique = vi.fn().mockResolvedValue({
      key: "connector",
      name: "Steckverbinder Spezial",
      description: "Bearbeitete Version",
      fieldsJson: serializeTechnicalFieldPresetFields([
        {
          key: "pitch",
          name: "Raster",
          type: "TEXT",
          unit: "mm",
          required: false,
          sortOrder: 10,
          valueCatalog: []
        }
      ])
    });

    const preset = await getStoredTechnicalFieldPreset(
      {
        technicalFieldPreset: {
          findMany,
          findUnique
        }
      },
      "connector"
    );

    expect(preset?.name).toBe("Steckverbinder Spezial");
    expect(preset?.fields[0]?.key).toBe("pitch");
  });
});
