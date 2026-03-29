import { describe, expect, it, vi } from "vitest";
import { buildTransferSourceGroups, validateTransferTarget } from "@/lib/item-transfer";

describe("item transfer helpers", () => {
  it("accepts transfer targets without shelf and normalizes empty values", async () => {
    const locationId = "11111111-1111-4111-8111-111111111111";
    const storageLocationFindUniqueMock = vi.fn().mockResolvedValue({
      id: locationId,
      name: "Werkstatt",
      code: "WERK"
    });
    const storageShelfFindFirstMock = vi.fn();

    const result = await validateTransferTarget(
      {
        storageLocation: {
          findUnique: storageLocationFindUniqueMock
        },
        storageShelf: {
          findFirst: storageShelfFindFirstMock
        }
      } as never,
      {
        storageLocationId: locationId,
        storageArea: "   ",
        allowedLocationIds: [locationId]
      }
    );

    expect(result).toEqual({
      location: {
        id: locationId,
        name: "Werkstatt",
        code: "WERK"
      },
      storageArea: null
    });
    expect(storageShelfFindFirstMock).not.toHaveBeenCalled();
  });

  it("rejects transfer targets outside the allowed storage scope", async () => {
    const storageLocationFindUniqueMock = vi.fn();

    await expect(
      validateTransferTarget(
        {
          storageLocation: {
            findUnique: storageLocationFindUniqueMock
          },
          storageShelf: {
            findFirst: vi.fn()
          }
        } as never,
        {
          storageLocationId: "22222222-2222-4222-8222-222222222222",
          allowedLocationIds: ["11111111-1111-4111-8111-111111111111"]
        }
      )
    ).rejects.toThrow("TRANSFER_TARGET_FORBIDDEN");

    expect(storageLocationFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects shelves that do not belong to the target location", async () => {
    const locationId = "33333333-3333-4333-8333-333333333333";
    const storageLocationFindUniqueMock = vi.fn().mockResolvedValue({
      id: locationId,
      name: "Labor",
      code: "LAB"
    });
    const storageShelfFindFirstMock = vi.fn().mockResolvedValue(null);

    await expect(
      validateTransferTarget(
        {
          storageLocation: {
            findUnique: storageLocationFindUniqueMock
          },
          storageShelf: {
            findFirst: storageShelfFindFirstMock
          }
        } as never,
        {
          storageLocationId: locationId,
          storageArea: "Regal 9",
          allowedLocationIds: [locationId]
        }
      )
    ).rejects.toThrow("TRANSFER_TARGET_SHELF_INVALID");
  });

  it("groups bulk transfer preview items by source place", () => {
    const groups = buildTransferSourceGroups([
      {
        id: "item-1",
        storageLocationId: "loc-1",
        storageArea: "A",
        bin: "1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" }
      },
      {
        id: "item-2",
        storageLocationId: "loc-1",
        storageArea: "A",
        bin: "1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" }
      },
      {
        id: "item-3",
        storageLocationId: "loc-2",
        storageArea: null,
        bin: null,
        storageLocation: { id: "loc-2", name: "Lager 2", code: "L2" }
      }
    ]);

    expect(groups).toEqual([
      {
        storageLocationId: "loc-2",
        storageLocationName: "Lager 2",
        storageArea: null,
        bin: null,
        count: 1
      },
      {
        storageLocationId: "loc-1",
        storageLocationName: "Werkstatt",
        storageArea: "A",
        bin: "1",
        count: 2
      }
    ]);
  });
});
