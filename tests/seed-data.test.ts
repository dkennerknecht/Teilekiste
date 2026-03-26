import { describe, expect, it, vi } from "vitest";

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password")
  }
}));

import { seedDatabase } from "@/prisma/seed-data";

describe("seedDatabase", () => {
  it("does not recreate sample records that already exist", async () => {
    const stockMovementFindFirstMock = vi
      .fn()
      .mockResolvedValueOnce({ id: "movement-existing-1" })
      .mockResolvedValueOnce(null);
    const stockMovementCreateMock = vi.fn().mockResolvedValue({ id: "movement-created" });
    const reservationFindFirstMock = vi.fn().mockResolvedValue({ id: "reservation-existing" });
    const reservationCreateMock = vi.fn();
    const attachmentFindFirstMock = vi.fn().mockResolvedValue({ id: "attachment-existing" });
    const attachmentCreateMock = vi.fn();

    const prisma = {
      user: { upsert: vi.fn().mockResolvedValue({ id: "admin-id" }) },
      category: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: "cat-1" })
          .mockResolvedValueOnce({ id: "cat-2" })
          .mockResolvedValueOnce({ id: "cat-3" })
          .mockResolvedValueOnce({ id: "cat-4" })
          .mockResolvedValueOnce({ id: "cat-5" })
      },
      storageLocation: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: "loc-1" })
          .mockResolvedValueOnce({ id: "loc-2" })
          .mockResolvedValueOnce({ id: "loc-3" })
      },
      tag: { upsert: vi.fn().mockResolvedValue({}) },
      area: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: "area-el" })
          .mockResolvedValueOnce({ id: "area-nw" })
      },
      labelType: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: "type-kb" })
          .mockResolvedValueOnce({ id: "type-sw" })
      },
      sequenceCounter: { upsert: vi.fn().mockResolvedValue({}) },
      labelConfig: { upsert: vi.fn().mockResolvedValue({}) },
      customField: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: "field-voltage" })
          .mockResolvedValueOnce({ id: "field-tolerance" })
      },
      item: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: "item-esp32", labelCode: "EL-KB-023" })
          .mockResolvedValueOnce({ id: "item-switch", labelCode: "NW-SW-104" })
      },
      itemCustomFieldValue: { upsert: vi.fn().mockResolvedValue({}) },
      stockMovement: {
        findFirst: stockMovementFindFirstMock,
        create: stockMovementCreateMock
      },
      reservation: {
        findFirst: reservationFindFirstMock,
        create: reservationCreateMock
      },
      attachment: {
        findFirst: attachmentFindFirstMock,
        create: attachmentCreateMock
      }
    };

    const result = await seedDatabase(prisma);

    expect(result).toEqual({
      adminEmail: "admin@local",
      sampleItemCodes: ["EL-KB-023", "NW-SW-104"]
    });
    expect(stockMovementFindFirstMock).toHaveBeenCalledTimes(2);
    expect(stockMovementCreateMock).toHaveBeenCalledTimes(1);
    expect(stockMovementCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: -2,
          reason: "CONSUMPTION",
          note: "Prototyp A"
        })
      })
    );
    expect(reservationCreateMock).not.toHaveBeenCalled();
    expect(attachmentCreateMock).not.toHaveBeenCalled();
  });
});
