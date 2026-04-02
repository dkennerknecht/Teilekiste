import { describe, expect, it, vi } from "vitest";
import { buildTransferSourceGroups, validateTransferTarget } from "@/lib/item-transfer";

describe("item transfer helpers", () => {
  it("accepts open-area transfer targets", async () => {
    const locationId = "11111111-1111-4111-8111-111111111111";
    const shelfId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const storageLocationFindUniqueMock = vi.fn().mockResolvedValue({
      id: locationId,
      name: "Werkstatt",
      code: "WERK"
    });
    const storageShelfFindUniqueMock = vi.fn().mockResolvedValue({
      id: shelfId,
      name: "Sicherungen",
      code: "SB1",
      description: "Sicherungen",
      mode: "OPEN_AREA",
      storageLocationId: locationId
    });

    const result = await validateTransferTarget(
      {
        storageLocation: {
          findUnique: storageLocationFindUniqueMock
        },
        storageShelf: {
          findUnique: storageShelfFindUniqueMock
        },
        storageBin: {
          findUnique: vi.fn()
        },
        item: {
          findFirst: vi.fn()
        }
      } as never,
      {
        storageLocationId: locationId,
        storageShelfId: shelfId,
        allowedLocationIds: [locationId]
      }
    );

    expect(result).toEqual({
      location: {
        id: locationId,
        name: "Werkstatt",
        code: "WERK"
      },
      storageShelf: {
        id: shelfId,
        name: "Sicherungen",
        code: "SB1",
        description: "Sicherungen",
        mode: "OPEN_AREA",
        storageLocationId: locationId
      },
      storageBin: null,
      binSlot: null
    });
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
            findUnique: vi.fn()
          },
          storageBin: {
            findUnique: vi.fn()
          },
          item: {
            findFirst: vi.fn()
          }
        } as never,
        {
          storageLocationId: "22222222-2222-4222-8222-222222222222",
          storageShelfId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          allowedLocationIds: ["11111111-1111-4111-8111-111111111111"]
        }
      )
    ).rejects.toThrow("TRANSFER_TARGET_FORBIDDEN");

    expect(storageLocationFindUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects shelves that do not belong to the target location", async () => {
    const locationId = "33333333-3333-4333-8333-333333333333";
    const shelfId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const storageLocationFindUniqueMock = vi.fn().mockResolvedValue({
      id: locationId,
      name: "Labor",
      code: "LAB"
    });
    const storageShelfFindUniqueMock = vi.fn().mockResolvedValue({
      id: shelfId,
      name: "Fremdregal",
      code: "SB9",
      description: null,
      mode: "OPEN_AREA",
      storageLocationId: "44444444-4444-4444-8444-444444444444"
    });

    await expect(
      validateTransferTarget(
        {
          storageLocation: {
            findUnique: storageLocationFindUniqueMock
          },
          storageShelf: {
            findUnique: storageShelfFindUniqueMock
          },
          storageBin: {
            findUnique: vi.fn()
          },
          item: {
            findFirst: vi.fn()
          }
        } as never,
        {
          storageLocationId: locationId,
          storageShelfId: shelfId,
          allowedLocationIds: [locationId]
        }
      )
    ).rejects.toThrow("TRANSFER_TARGET_SHELF_INVALID");
  });

  it("accepts single-slot drawers without requiring an explicit slot", async () => {
    const locationId = "55555555-5555-4555-8555-555555555555";
    const shelfId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const binId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const storageLocationFindUniqueMock = vi.fn().mockResolvedValue({
      id: locationId,
      name: "Werkstatt",
      code: "WERK"
    });
    const storageShelfFindUniqueMock = vi.fn().mockResolvedValue({
      id: shelfId,
      name: "Kleinteilemagazin",
      code: "SA1",
      description: null,
      mode: "DRAWER_HOST",
      storageLocationId: locationId
    });
    const storageBinFindUniqueMock = vi.fn().mockResolvedValue({
      id: binId,
      code: "A01",
      slotCount: 1,
      storageLocationId: locationId,
      storageShelfId: shelfId,
      isActive: true
    });
    const itemFindFirstMock = vi.fn().mockResolvedValue(null);

    const result = await validateTransferTarget(
      {
        storageLocation: {
          findUnique: storageLocationFindUniqueMock
        },
        storageShelf: {
          findUnique: storageShelfFindUniqueMock
        },
        storageBin: {
          findUnique: storageBinFindUniqueMock
        },
        item: {
          findFirst: itemFindFirstMock
        }
      } as never,
      {
        storageLocationId: locationId,
        storageShelfId: shelfId,
        storageBinId: binId,
        allowedLocationIds: [locationId]
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        storageBin: expect.objectContaining({ id: binId, code: "A01" }),
        binSlot: null
      })
    );
    expect(itemFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storageBinId: binId,
          binSlot: null
        })
      })
    );
  });

  it("groups bulk transfer preview items by source place", () => {
    const groups = buildTransferSourceGroups([
      {
        id: "item-1",
        storageLocationId: "loc-1",
        storageArea: "Automaten",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        storageShelfId: "shelf-1",
        storageShelf: { id: "shelf-1", name: "Automaten", code: "SB1", mode: "OPEN_AREA", storageLocationId: "loc-1" }
      },
      {
        id: "item-2",
        storageLocationId: "loc-1",
        storageArea: "Automaten",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        storageShelfId: "shelf-1",
        storageShelf: { id: "shelf-1", name: "Automaten", code: "SB1", mode: "OPEN_AREA", storageLocationId: "loc-1" }
      },
      {
        id: "item-3",
        storageLocationId: "loc-2",
        storageArea: null,
        storageLocation: { id: "loc-2", name: "Lager 2", code: "L2" }
      }
    ]);

    expect(groups).toEqual([
      {
        storageLocationId: "loc-2",
        storageLocationName: "Lager 2",
        storageShelfId: null,
        storageShelfCode: null,
        storageShelfName: null,
        storageBinId: null,
        storageBinCode: null,
        storageArea: null,
        bin: null,
        binSlot: null,
        displayPosition: "Lager 2",
        count: 1
      },
      {
        storageLocationId: "loc-1",
        storageLocationName: "Werkstatt",
        storageShelfId: "shelf-1",
        storageShelfCode: "SB1",
        storageShelfName: "Automaten",
        storageBinId: null,
        storageBinCode: null,
        storageArea: "Automaten",
        bin: null,
        binSlot: null,
        displayPosition: "Werkstatt / SB1",
        count: 2
      }
    ]);
  });
});
