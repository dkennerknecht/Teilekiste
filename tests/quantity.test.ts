import { describe, expect, it } from "vitest";
import { QuantityValidationError, fromStoredQuantity, toStoredQuantity } from "@/lib/quantity";

describe("quantity helpers", () => {
  it("stores meter quantities internally as millimeters", () => {
    expect(toStoredQuantity("M", 12.5, { field: "Bestand" })).toBe(12500);
    expect(toStoredQuantity("M", 0.35, { field: "Mindestbestand", nullable: true })).toBe(350);
    expect(fromStoredQuantity("M", 1250)).toBe(1.25);
  });

  it("keeps non-meter units integer-only", () => {
    expect(toStoredQuantity("STK", 5, { field: "Bestand" })).toBe(5);
    expect(() => toStoredQuantity("STK", 1.5, { field: "Bestand" })).toThrow(QuantityValidationError);
  });
});
