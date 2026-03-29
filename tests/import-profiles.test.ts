import { describe, expect, it } from "vitest";
import {
  buildImportHeaderFingerprint,
  buildSuggestedImportMappingConfig,
  getImportProfileMatchScore,
  normalizeImportLookup,
  parseImportCsv
} from "@/lib/import-profiles";

describe("import profile helpers", () => {
  it("normalizes headers and computes matching fingerprints", () => {
    const fingerprint = buildImportHeaderFingerprint([" Kategorie ", "Typ", "Lagerort"]);
    expect(fingerprint).toBe("kategorie|typ|lagerort");
    expect(getImportProfileMatchScore("kategorie|typ|lagerort", fingerprint)).toBe(100);
    expect(normalizeImportLookup("Lager-Ort")).toBe("lager ort");
  });

  it("detects semicolon csv and suggests core/custom mappings", () => {
    const parsed = parseImportCsv(["Kategorie;Name;Farbe", "Kabel;Leitung;rot"].join("\n"), "AUTO");
    expect(parsed.delimiterMode).toBe("SEMICOLON");
    expect(parsed.headers).toEqual(["Kategorie", "Name", "Farbe"]);

    const mapping = buildSuggestedImportMappingConfig(parsed.headers, [
      {
        id: "field-color",
        name: "Farbe",
        key: "farbe",
        type: "TEXT"
      }
    ] as any);

    expect(mapping.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetKey: "category", sourceType: "column", column: "Kategorie" }),
        expect.objectContaining({ targetKey: "name", sourceType: "column", column: "Name" }),
        expect.objectContaining({ targetKey: "customField:field-color", sourceType: "column", column: "Farbe" })
      ])
    );
  });
});
