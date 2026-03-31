import { describe, expect, it, vi } from "vitest";
import { previewStorageBinSlotCountChange, resolveItemPlacement } from "@/lib/storage-bins";

describe("storage bin helpers", () => {
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
        storageArea: null,
        bin: null,
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
            storageArea: "Magazin A",
            slotCount: 3,
            isActive: true
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
        storageArea: "Magazin A",
        bin: "A12",
        storageBinId: "bin-1",
        binSlot: 2
      })
    );
    expect(itemFindFirstMock).toHaveBeenCalledTimes(1);
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
