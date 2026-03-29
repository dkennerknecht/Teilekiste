import { describe, expect, it } from "vitest";
import { buildDuplicatePairs, findDuplicateCandidates, getMergeEligibility } from "@/lib/item-duplicates";

const baseItems = [
  {
    id: "item-1",
    labelCode: "EL-MC-001",
    name: "ESP32 DevKit V1",
    categoryId: "cat-1",
    typeId: "type-mc",
    unit: "STK",
    manufacturer: "Espressif",
    mpn: "ESP32-DEVKIT-V1",
    isArchived: false,
    deletedAt: null,
    mergedIntoItemId: null,
    mergedAt: null
  },
  {
    id: "item-2",
    labelCode: "EL-MC-002",
    name: "ESP32 DevKit V1",
    categoryId: "cat-1",
    typeId: "type-mc",
    unit: "STK",
    manufacturer: "Espressif",
    mpn: "ESP32-DEVKIT-V1",
    isArchived: false,
    deletedAt: null,
    mergedIntoItemId: null,
    mergedAt: null
  }
];

describe("item duplicate logic", () => {
  it("finds warning candidates for partial names", () => {
    const matches = findDuplicateCandidates(baseItems, {
      name: "ESP32",
      manufacturer: "",
      mpn: "",
      categoryId: "cat-1",
      typeId: "type-mc",
      unit: "STK"
    });

    expect(matches).toHaveLength(2);
    expect(matches[0].score).toBeGreaterThanOrEqual(35);
    expect(matches[0].reasons).toContain("Aehnlicher Name");
  });

  it("builds mergeable duplicate pairs for exact matches", () => {
    const pairs = buildDuplicatePairs(baseItems);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].score).toBeGreaterThanOrEqual(100);
    expect(pairs[0].mergeEligible).toBe(true);
  });

  it("blocks merges when category, type or unit differ", () => {
    const eligibility = getMergeEligibility(baseItems[0], {
      ...baseItems[1],
      typeId: "type-other",
      unit: "M"
    });

    expect(eligibility.mergeEligible).toBe(false);
    expect(eligibility.mergeBlockedReasons).toContain("Merge nur bei gleichem Type moeglich");
    expect(eligibility.mergeBlockedReasons).toContain("Merge nur bei gleicher Einheit moeglich");
  });
});
