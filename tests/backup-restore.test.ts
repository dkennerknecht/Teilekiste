import { afterEach, describe, expect, it, vi } from "vitest";

const userFindFirstMock = vi.fn();
const userUpdateMock = vi.fn();
const userCreateMock = vi.fn();
const categoryFindFirstMock = vi.fn();
const categoryUpdateMock = vi.fn();
const categoryCreateMock = vi.fn();
const locationFindFirstMock = vi.fn();
const locationUpdateMock = vi.fn();
const locationCreateMock = vi.fn();
const tagFindFirstMock = vi.fn();
const tagUpdateMock = vi.fn();
const tagCreateMock = vi.fn();
const customFieldUpsertMock = vi.fn();
const itemFindUniqueMock = vi.fn();
const itemUpsertMock = vi.fn();
const itemTagUpsertMock = vi.fn();
const itemCustomFieldValueUpsertMock = vi.fn();
const itemImageUpsertMock = vi.fn();
const attachmentUpsertMock = vi.fn();
const stockMovementUpsertMock = vi.fn();
const reservationUpsertMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: userFindFirstMock,
      update: userUpdateMock,
      create: userCreateMock
    },
    category: {
      findFirst: categoryFindFirstMock,
      update: categoryUpdateMock,
      create: categoryCreateMock
    },
    storageLocation: {
      findFirst: locationFindFirstMock,
      update: locationUpdateMock,
      create: locationCreateMock
    },
    tag: {
      findFirst: tagFindFirstMock,
      update: tagUpdateMock,
      create: tagCreateMock
    },
    customField: {
      upsert: customFieldUpsertMock
    },
    item: {
      findUnique: itemFindUniqueMock,
      upsert: itemUpsertMock
    },
    itemTag: {
      upsert: itemTagUpsertMock
    },
    itemCustomFieldValue: {
      upsert: itemCustomFieldValueUpsertMock
    },
    itemImage: {
      upsert: itemImageUpsertMock
    },
    attachment: {
      upsert: attachmentUpsertMock
    },
    stockMovement: {
      upsert: stockMovementUpsertMock
    },
    reservation: {
      upsert: reservationUpsertMock
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("Backup restore", () => {
  it("maps merge conflicts to existing supporting rows and restores related item data", async () => {
    userFindFirstMock.mockResolvedValue({ id: "user-existing", email: "admin@local" });
    categoryFindFirstMock.mockResolvedValue({ id: "cat-existing", name: "Passive" });
    locationFindFirstMock.mockResolvedValue({ id: "loc-existing", name: "Shelf" });
    tagFindFirstMock.mockResolvedValue({ id: "tag-existing", name: "SMD" });
    customFieldUpsertMock.mockResolvedValue({ id: "field-existing" });
    itemFindUniqueMock.mockResolvedValue(null);
    itemUpsertMock.mockResolvedValue({ id: "item-1" });
    itemTagUpsertMock.mockResolvedValue({});
    itemCustomFieldValueUpsertMock.mockResolvedValue({});
    itemImageUpsertMock.mockResolvedValue({});
    attachmentUpsertMock.mockResolvedValue({});
    stockMovementUpsertMock.mockResolvedValue({});
    reservationUpsertMock.mockResolvedValue({});

    const { restoreBackupData } = await import("@/lib/backup-restore");
    const result = await restoreBackupData({
      strategy: "merge",
      fallbackUserId: "restoring-admin",
      payload: {
        users: [
          {
            id: "user-backup",
            name: "Admin",
            email: "admin@local",
            role: "ADMIN",
            isActive: true,
            passwordHash: "$2a$10$exampleexampleexampleexampleexampleexampleexample12"
          }
        ],
        categories: [{ id: "cat-backup", name: "Passive" }],
        locations: [{ id: "loc-backup", name: "Shelf", code: "SH" }],
        tags: [{ id: "tag-backup", name: "SMD" }],
        customFields: [
          {
            id: "field-backup",
            name: "Voltage",
            key: "voltage",
            type: "NUMBER",
            categoryId: "cat-backup",
            options: { unit: "V" },
            required: false,
            isActive: true
          }
        ],
        items: [
          {
            id: "item-1",
            labelCode: "EL-KB-001",
            name: "Resistor",
            description: "",
            categoryId: "cat-backup",
            storageLocationId: "loc-backup",
            stock: 10,
            unit: "STK",
            tags: [{ tagId: "tag-backup" }],
            customValues: [{ customFieldId: "field-backup", valueJson: 5 }],
            images: [
              {
                id: "image-1",
                path: "/snapshot/uploads/item-1/photo.jpg",
                thumbPath: "/snapshot/uploads/item-1/thumb-photo.jpg",
                mime: "image/jpeg",
                size: 128,
                isPrimary: true,
                sortOrder: 0,
                createdAt: "2026-03-20T10:00:00.000Z"
              }
            ],
            attachments: [
              {
                id: "attachment-1",
                path: "/snapshot/attachments/item-1/datasheet.pdf",
                mime: "application/pdf",
                size: 512,
                kind: "PDF",
                createdAt: "2026-03-20T10:00:00.000Z"
              }
            ],
            movements: [
              {
                id: "movement-1",
                delta: 10,
                reason: "PURCHASE",
                userId: "user-backup",
                createdAt: "2026-03-20T10:00:00.000Z"
              }
            ],
            reservations: [
              {
                id: "reservation-1",
                reservedQty: 2,
                reservedFor: "Fixture",
                userId: "user-backup",
                createdAt: "2026-03-20T10:00:00.000Z"
              }
            ]
          }
        ]
      }
    });

    expect(result.conflicts.categories).toEqual(["Passive"]);
    expect(result.conflicts.locations).toEqual(["Shelf"]);
    expect(result.conflicts.tags).toEqual(["SMD"]);

    expect(itemUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          categoryId: "cat-existing",
          storageLocationId: "loc-existing"
        }),
        update: expect.objectContaining({
          categoryId: "cat-existing",
          storageLocationId: "loc-existing"
        })
      })
    );

    expect(itemTagUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tagId: "tag-existing"
        })
      })
    );

    expect(itemCustomFieldValueUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          customFieldId: "field-existing"
        })
      })
    );

    expect(itemImageUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          path: "/data/uploads/item-1/photo.jpg",
          thumbPath: "/data/uploads/item-1/thumb-photo.jpg"
        })
      })
    );

    expect(attachmentUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          path: "/data/attachments/item-1/datasheet.pdf"
        })
      })
    );

    expect(stockMovementUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user-existing"
        })
      })
    );

    expect(reservationUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user-existing"
        })
      })
    );
  });
});
