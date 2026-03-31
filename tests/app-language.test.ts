import { describe, expect, it } from "vitest";
import { translateApiErrorMessage } from "@/lib/app-language";

describe("translateApiErrorMessage", () => {
  it("translates known german backend errors to english", () => {
    expect(translateApiErrorMessage("en", "Regal/Bereich ist fuer eingelagerten Bestand erforderlich")).toBe(
      "Shelf / area is required for placed stock"
    );
  });

  it("translates known english backend errors to german", () => {
    expect(translateApiErrorMessage("de", "Forbidden")).toBe("Nicht erlaubt");
  });

  it("keeps unknown messages unchanged", () => {
    expect(translateApiErrorMessage("en", "Something custom happened")).toBe("Something custom happened");
  });

  it("translates dynamic import mapping errors", () => {
    expect(translateApiErrorMessage("en", "Kategorie unbekannt: Widerstaende")).toBe("Category unknown: Widerstaende");
    expect(translateApiErrorMessage("en", "Zuordnung verweist auf fehlende Spalte: Part No")).toBe(
      "Mapping points to missing column: Part No"
    );
  });

  it("translates dynamic quantity errors", () => {
    expect(translateApiErrorMessage("en", "Bestand ist ungueltig")).toBe("Stock is invalid");
    expect(translateApiErrorMessage("en", "Mindestbestand darf nicht negativ sein")).toBe("Minimum stock cannot be negative");
  });

  it("translates common zod validation messages for german ui", () => {
    expect(translateApiErrorMessage("de", "String must contain at least 2 character(s)")).toBe(
      "Text muss mindestens 2 Zeichen enthalten"
    );
    expect(translateApiErrorMessage("de", "Invalid url")).toBe("Ungueltige URL");
  });
});
