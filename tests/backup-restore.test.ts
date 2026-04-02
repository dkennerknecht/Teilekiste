import { afterEach, describe, expect, it, vi } from "vitest";

const userFindFirstMock = vi.fn();
const userUpdateMock = vi.fn();
const userCreateMock = vi.fn();
const userLocationDeleteManyMock = vi.fn();
const userLocationCreateMock = vi.fn();
const categoryFindFirstMock = vi.fn();
const categoryUpdateMock = vi.fn();
const categoryCreateMock = vi.fn();
const locationFindFirstMock = vi.fn();
const locationUpdateMock = vi.fn();
const locationCreateMock = vi.fn();
const storageShelfFindFirstMock = vi.fn();
const storageShelfUpdateMock = vi.fn();
const storageShelfCreateMock = vi.fn();
const storageBinFindFirstMock = vi.fn();
const storageBinUpdateMock = vi.fn();
const storageBinCreateMock = vi.fn();
const inventorySessionUpsertMock = vi.fn();
const inventorySessionRowUpsertMock = vi.fn();
const favoriteUpsertMock = vi.fn();
const recentViewUpsertMock = vi.fn();
const apiTokenUpsertMock = vi.fn();
const accountUpsertMock = vi.fn();
const sessionUpsertMock = vi.fn();
const verificationTokenUpsertMock = vi.fn();
const categoryTypeCounterUpsertMock = vi.fn();
const areaFindFirstMock = vi.fn();
const areaUpdateMock = vi.fn();
const areaCreateMock = vi.fn();
const labelTypeFindFirstMock = vi.fn();
const labelTypeUpdateMock = vi.fn();
const labelTypeCreateMock = vi.fn();
const tagFindFirstMock = vi.fn();
const tagUpdateMock = vi.fn();
const tagCreateMock = vi.fn();
const importProfileUpsertMock = vi.fn();
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
    userLocation: {
      deleteMany: userLocationDeleteManyMock,
      create: userLocationCreateMock
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
    storageShelf: {
      findFirst: storageShelfFindFirstMock,
      update: storageShelfUpdateMock,
      create: storageShelfCreateMock
    },
    storageBin: {
      findFirst: storageBinFindFirstMock,
      update: storageBinUpdateMock,
      create: storageBinCreateMock
    },
    inventorySession: {
      upsert: inventorySessionUpsertMock
    },
    inventorySessionRow: {
      upsert: inventorySessionRowUpsertMock
    },
    favorite: {
      upsert: favoriteUpsertMock
    },
    recentView: {
      upsert: recentViewUpsertMock
    },
    apiToken: {
      upsert: apiTokenUpsertMock
    },
    account: {
      upsert: accountUpsertMock
    },
    session: {
      upsert: sessionUpsertMock
    },
    verificationToken: {
      upsert: verificationTokenUpsertMock
    },
    categoryTypeCounter: {
      upsert: categoryTypeCounterUpsertMock
    },
    area: {
      findFirst: areaFindFirstMock,
      update: areaUpdateMock,
      create: areaCreateMock
    },
    labelType: {
      findFirst: labelTypeFindFirstMock,
      update: labelTypeUpdateMock,
      create: labelTypeCreateMock
    },
    tag: {
      findFirst: tagFindFirstMock,
      update: tagUpdateMock,
      create: tagCreateMock
    },
    importProfile: {
      upsert: importProfileUpsertMock
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
    userLocationDeleteManyMock.mockResolvedValue({});
    userLocationCreateMock.mockResolvedValue({});
    categoryFindFirstMock.mockResolvedValue({ id: "cat-existing", name: "Passive" });
    locationFindFirstMock.mockResolvedValue({ id: "loc-existing", name: "Shelf" });
    tagFindFirstMock.mockResolvedValue({ id: "tag-existing", name: "SMD" });
    importProfileUpsertMock.mockResolvedValue({ id: "profile-existing" });
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
            passwordHash: "$2a$10$exampleexampleexampleexampleexampleexampleexample12",
            allowedLocationIds: ["loc-backup"]
          }
        ],
        categories: [{ id: "cat-backup", name: "Passive" }],
        locations: [{ id: "loc-backup", name: "Shelf", code: "SH" }],
        tags: [{ id: "tag-backup", name: "SMD" }],
        importProfiles: [
          {
            id: "profile-backup",
            name: "Supplier CSV",
            headerFingerprint: "name|typ|lagerort",
            delimiterMode: "SEMICOLON",
            mappingConfig: {
              assignments: [{ targetKey: "name", sourceType: "column", column: "Artikelname" }]
            }
          }
        ],
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

    expect(importProfileUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: "Supplier CSV",
          delimiterMode: "SEMICOLON"
        }),
        update: expect.objectContaining({
          headerFingerprint: "name|typ|lagerort"
        })
      })
    );
    expect(result.restoredImportProfiles).toBe(1);

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

    expect(userLocationDeleteManyMock).toHaveBeenCalledWith({ where: { userId: "user-existing" } });
    expect(userLocationCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: "user-existing",
          storageLocationId: "loc-existing"
        }
      })
    );
  });

  it("restores shelves, drawers, and item placement state for a fresh app", async () => {
    userFindFirstMock.mockResolvedValue(null);
    userCreateMock.mockResolvedValue({ id: "user-backup" });
    userLocationDeleteManyMock.mockResolvedValue({});
    userLocationCreateMock.mockResolvedValue({});
    categoryFindFirstMock.mockResolvedValue(null);
    categoryCreateMock.mockResolvedValue({ id: "cat-backup", name: "Passive" });
    locationFindFirstMock.mockResolvedValue(null);
    locationCreateMock.mockResolvedValue({ id: "loc-backup", name: "Werkstatt" });
    areaFindFirstMock.mockResolvedValue(null);
    areaCreateMock.mockResolvedValue({ id: "area-1", code: "EL" });
    labelTypeFindFirstMock.mockResolvedValue(null);
    labelTypeCreateMock.mockResolvedValue({ id: "type-1", code: "SI" });
    storageShelfFindFirstMock.mockResolvedValue(null);
    storageShelfCreateMock.mockResolvedValue({ id: "shelf-backup" });
    storageBinFindFirstMock.mockResolvedValue(null);
    storageBinCreateMock.mockResolvedValue({ id: "bin-backup" });
    inventorySessionUpsertMock.mockResolvedValue({ id: "inv-session-1" });
    inventorySessionRowUpsertMock.mockResolvedValue({ id: "inv-row-1" });
    favoriteUpsertMock.mockResolvedValue({});
    recentViewUpsertMock.mockResolvedValue({});
    apiTokenUpsertMock.mockResolvedValue({});
    accountUpsertMock.mockResolvedValue({});
    sessionUpsertMock.mockResolvedValue({});
    verificationTokenUpsertMock.mockResolvedValue({});
    categoryTypeCounterUpsertMock.mockResolvedValue({});
    itemFindUniqueMock.mockResolvedValue(null);
    itemUpsertMock.mockResolvedValue({ id: "item-1" });

    const { restoreBackupData } = await import("@/lib/backup-restore");
    const result = await restoreBackupData({
      strategy: "overwrite",
      fallbackUserId: "restoring-admin",
      payload: {
        users: [
          {
            id: "user-backup",
            name: "Admin",
            email: "admin@example.com",
            role: "ADMIN",
            isActive: true,
            passwordHash: "$2a$10$exampleexampleexampleexampleexampleexampleexample12",
            allowedLocationIds: ["loc-backup"]
          }
        ],
        categories: [{ id: "cat-backup", name: "Passive" }],
        locations: [{ id: "loc-backup", name: "Werkstatt", code: "WS" }],
        categoryTypeCounters: [
          {
            id: "cat-type-counter-1",
            categoryId: "cat-backup",
            typeId: "type-1",
            nextNumber: 42
          }
        ],
        shelves: [
          {
            id: "shelf-backup",
            storageLocationId: "loc-backup",
            name: "Automaten",
            code: "AB",
            description: "LS und FI",
            mode: "DRAWER_HOST"
          }
        ],
        bins: [
          {
            id: "bin-backup",
            storageLocationId: "loc-backup",
            storageShelfId: "shelf-backup",
            code: "01",
            storageArea: "Automaten",
            slotCount: 3,
            isActive: true
          }
        ],
        inventorySessions: [
          {
            id: "inv-session-1",
            title: "Werkstatt April",
            status: "OPEN",
            storageLocationId: "loc-backup",
            storageArea: "Automaten",
            ownerUserId: "user-backup",
            createdByUserId: "user-backup",
            note: "Session note"
          }
        ],
        inventorySessionRows: [
          {
            id: "inv-row-1",
            sessionId: "inv-session-1",
            itemId: "item-1",
            labelCode: "EL-SI-001",
            name: "LS B16",
            unit: "STK",
            storageArea: "Automaten",
            storageShelfCode: "AB",
            storageBinCode: "01",
            binSlot: 2,
            expectedStock: 12,
            countedStock: 11,
            countedByUserId: "user-backup",
            note: "Counted"
          }
        ],
        favorites: [
          {
            userId: "user-backup",
            itemId: "item-1"
          }
        ],
        recentViews: [
          {
            userId: "user-backup",
            itemId: "item-1",
            lastViewedAt: "2026-04-01T12:00:00.000Z"
          }
        ],
        apiTokens: [
          {
            id: "token-1",
            name: "CLI",
            tokenHash: "hash-1",
            isActive: true,
            userId: "user-backup"
          }
        ],
        accounts: [
          {
            id: "account-1",
            userId: "user-backup",
            type: "credentials",
            provider: "credentials",
            providerAccountId: "admin@example.com"
          }
        ],
        sessions: [
          {
            id: "session-1",
            sessionToken: "session-token-1",
            userId: "user-backup",
            expires: "2026-05-01T00:00:00.000Z"
          }
        ],
        verificationTokens: [
          {
            identifier: "admin@example.com",
            token: "verify-token-1",
            expires: "2026-05-01T00:00:00.000Z"
          }
        ],
        areas: [{ id: "area-1", code: "EL", name: "Elektronik", active: true }],
        types: [{ id: "type-1", areaId: "area-1", code: "SI", name: "Sicherung", active: true }],
        items: [
          {
            id: "item-1",
            labelCode: "EL-SI-001",
            name: "LS B16",
            description: "Leitungsschutzschalter",
            categoryId: "cat-backup",
            storageLocationId: "loc-backup",
            storageShelfId: "shelf-backup",
            storageArea: "Automaten",
            storageBinId: "bin-backup",
            binSlot: 2,
            placementStatus: "PLACED",
            stock: 12,
            incomingQty: 4,
            unit: "STK",
            minStock: 2,
            movements: [
              {
                id: "movement-1",
                delta: 12,
                reason: "INVENTORY",
                userId: "user-backup",
                inventorySessionId: "inv-session-1"
              }
            ]
          }
        ]
      }
    });

    expect(storageShelfCreateMock).toHaveBeenCalledWith({
      data: {
        id: "shelf-backup",
        name: "Automaten",
        storageLocationId: "loc-backup",
        code: "AB",
        description: "LS und FI",
        mode: "DRAWER_HOST"
      }
    });

    expect(storageBinCreateMock).toHaveBeenCalledWith({
      data: {
        id: "bin-backup",
        code: "01",
        storageLocationId: "loc-backup",
        storageShelfId: "shelf-backup",
        storageArea: "Automaten",
        slotCount: 3,
        isActive: true
      }
    });

    expect(itemUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          storageLocationId: "loc-backup",
          storageShelfId: "shelf-backup",
          storageBinId: "bin-backup",
          binSlot: 2,
          placementStatus: "PLACED",
          stock: 12,
          incomingQty: 4
        }),
        update: expect.objectContaining({
          storageLocationId: "loc-backup",
          storageShelfId: "shelf-backup",
          storageBinId: "bin-backup",
          binSlot: 2,
          placementStatus: "PLACED",
          stock: 12,
          incomingQty: 4
        })
      })
    );

    expect(categoryTypeCounterUpsertMock).toHaveBeenCalledWith({
      where: {
        categoryId_typeId: {
          categoryId: "cat-backup",
          typeId: "type-1"
        }
      },
      update: {
        nextNumber: 42
      },
      create: {
        id: "cat-type-counter-1",
        categoryId: "cat-backup",
        typeId: "type-1",
        nextNumber: 42
      }
    });

    expect(inventorySessionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: "inv-session-1",
          storageLocationId: "loc-backup",
          ownerUserId: "user-backup",
          createdByUserId: "user-backup"
        })
      })
    );

    expect(inventorySessionRowUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sessionId: "inv-session-1",
          itemId: "item-1",
          storageShelfCode: "AB",
          storageBinCode: "01",
          binSlot: 2
        })
      })
    );

    expect(stockMovementUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          inventorySessionId: "inv-session-1",
          userId: "user-backup"
        })
      })
    );

    expect(favoriteUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user-backup",
          itemId: "item-1"
        })
      })
    );

    expect(recentViewUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user-backup",
          itemId: "item-1"
        })
      })
    );

    expect(apiTokenUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: "token-1",
          tokenHash: "hash-1",
          userId: "user-backup"
        })
      })
    );

    expect(accountUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: "account-1",
          userId: "user-backup",
          provider: "credentials",
          providerAccountId: "admin@example.com"
        })
      })
    );

    expect(sessionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: "session-1",
          sessionToken: "session-token-1",
          userId: "user-backup"
        })
      })
    );

    expect(verificationTokenUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          identifier: "admin@example.com",
          token: "verify-token-1"
        })
      })
    );

    expect(result.restoredLocations).toBe(1);
    expect(result.restoredShelves).toBe(1);
    expect(result.restoredBins).toBe(1);
    expect(result.restoredCategoryTypeCounters).toBe(1);
    expect(result.restoredItems).toBe(1);
  });
});
