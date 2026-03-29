import { describe, expect, it } from "vitest";
import { CustomFieldValidationError, normalizeCustomFieldValue, parseCustomFieldValueCatalog } from "@/lib/custom-fields";

describe("custom field catalogs", () => {
  it("parses structured catalogs and falls back to legacy options", () => {
    expect(
      parseCustomFieldValueCatalog({
        options: null,
        valueCatalog: JSON.stringify([
          { value: "Rot", aliases: ["red", "rot"], sortOrder: 1 },
          { value: "Blau", aliases: ["blue"], sortOrder: 0 }
        ])
      })
    ).toEqual([
      { value: "Blau", aliases: ["blue"], sortOrder: 0 },
      { value: "Rot", aliases: ["red", "rot"], sortOrder: 1 }
    ]);

    expect(parseCustomFieldValueCatalog({ options: JSON.stringify(["1%", "5%"]), valueCatalog: null })).toEqual([
      { value: "1%", aliases: [], sortOrder: 0 },
      { value: "5%", aliases: [], sortOrder: 1 }
    ]);
  });

  it("canonicalizes alias input for text fields", () => {
    expect(
      normalizeCustomFieldValue(
        {
          id: "field-1",
          name: "Farbe",
          type: "TEXT",
          options: null,
          valueCatalog: JSON.stringify([{ value: "Rot", aliases: ["red", "rot"], sortOrder: 0 }])
        },
        "red"
      )
    ).toBe("Rot");
  });

  it("rejects unknown locked values for selects", () => {
    expect(() =>
      normalizeCustomFieldValue(
        {
          id: "field-2",
          name: "Toleranz",
          type: "SELECT",
          options: null,
          valueCatalog: JSON.stringify([{ value: "1%", aliases: [], sortOrder: 0 }])
        },
        "2%"
      )
    ).toThrow(CustomFieldValidationError);
  });
});
