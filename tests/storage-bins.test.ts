import { describe, expect, it, vi } from "vitest";
import {
  formatDrawerPosition,
  formatStorageBinLabel,
  normalizeStorageBinCode,
  previewStorageBinSlotCountChange,
  resolveItemPlacement
} from "@/lib/storage-bins";

describe("storage bin helpers", () => {
  it("formats managed drawer labels from shelf and numeric drawer codes", () => {
    expect(normalizeStorageBinCode("1")).toBe("01");
    expect(formatStorageBinLabel({ shelfCode: "ab", binCode: "1" })).toBe("AB01");
    expect(formatDrawerPosition("1", 2, 3, "ab")).toBe("AB01-2");
  });

  it("allows incoming items without any location assignment", async () => {
    const placement = await resolveItemPlacement(
      {
        storageLocation: { findUnique: vi.fn() },
        storageShelf: { findFirst: vi.fn() },
        storageBin: { findUnique: vi.fn() },
        item: { findFirst: vi.fn() }
      } as never,
      {
        placementStatus: "INCOMING"
      }
    );

    expect(placement).toEqual(
      expect.objectContaining({
        placementStatus: "INCOMING",
        storageLocationId: null,
        storageShelfId: null,
        storageArea: null,
        storageBinId: null,
        binSlot: null
      })
    );
  });

  it("mirrors location and drawer code from managed bins", async () => {
    const itemFindFirstMock = vi.fn().mockResolvedValue(null);
    const placement = await resolveItemPlacement(
      {
        storageLocation: { findUnique: vi.fn() },
        storageShelf: { findFirst: vi.fn() },
        storageBin: {
          findUnique: vi.fn().mockResolvedValue({
            id: "bin-1",
            code: "A12",
            storageLocationId: "loc-1",
            storageShelfId: "shelf-1",
            storageArea: "Magazin A",
            slotCount: 3,
            isActive: true,
            storageShelf: {
              id: "shelf-1",
              name: "Magazin A",
              code: "SB1",
              description: null,
              mode: "DRAWER_HOST",
              storageLocationId: "loc-1"
            }
          })
        },
        item: { findFirst: itemFindFirstMock }
      } as never,
      {
        placementStatus: "PLACED",
        storageBinId: "bin-1",
        binSlot: 2,
        allowedLocationIds: ["loc-1"]
      }
    );

    expect(placement).toEqual(
      expect.objectContaining({
        placementStatus: "PLACED",
        storageLocationId: "loc-1",
        storageShelfId: "shelf-1",
        storageArea: "Magazin A",
        storageBinId: "bin-1",
        binSlot: 2
      })
    );
    expect(itemFindFirstMock).toHaveBeenCalledTimes(1);
  });

  it("allows single-slot drawers without requiring an explicit slot", async () => {
    const itemFindFirstMock = vi.fn().mockResolvedValue(null);
    const placement = await resolveItemPlacement(
      {
        storageLocation: { findUnique: vi.fn() },
        storageShelf: { findFirst: vi.fn() },
        storageBin: {
          findUnique: vi.fn().mockResolvedValue({
            id: "bin-1",
            code: "A01",
            storageLocationId: "loc-1",
            storageShelfId: "shelf-1",
            storageArea: "Magazin A",
            slotCount: 1,
            isActive: true,
            storageShelf: {
              id: "shelf-1",
              name: "Magazin A",
              code: "SB1",
              description: null,
              mode: "DRAWER_HOST",
              storageLocationId: "loc-1"
            }
          })
        },
        item: { findFirst: itemFindFirstMock }
      } as never,
      {
        placementStatus: "PLACED",
        storageBinId: "bin-1",
        allowedLocationIds: ["loc-1"]
      }
    );

    expect(placement).toEqual(
      expect.objectContaining({
        storageBinId: "bin-1",
        binSlot: null
      })
    );
    expect(itemFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storageBinId: "bin-1",
          binSlot: null
        })
      })
    );
  });

  it("previews items that would be displaced by a slotCount reduction", async () => {
    const preview = await previewStorageBinSlotCountChange(
      {
        storageBin: {
          findUnique: vi.fn().mockResolvedValue({
            id: "bin-1",
            code: "A12",
            storageLocationId: "loc-1",
            storageArea: "Magazin A",
            slotCount: 3
          })
        },
        item: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "item-3",
              labelCode: "EL-KB-003",
              name: "Klemme",
              binSlot: 3,
              stock: 5,
              incomingQty: 0,
              placementStatus: "PLACED"
            }
          ])
        }
      } as never,
      { id: "bin-1", slotCount: 2 }
    );

    expect(preview.storageBin.code).toBe("A12");
    expect(preview.displacedItems).toHaveLength(1);
    expect(preview.displacedItems[0]).toEqual(
      expect.objectContaining({
        id: "item-3",
        binSlot: 3
      })
    );
  });
});
