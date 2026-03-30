import { describe, expect, it, vi } from "vitest";
import {
  InventorySessionError,
  createInventorySession,
  finalizeInventorySession,
  updateInventorySessionCounts
} from "@/lib/inventory-sessions";

const { auditLogMock } = vi.hoisted(() => ({
  auditLogMock: vi.fn()
}));

vi.mock("@/lib/audit", () => ({
  auditLog: auditLogMock
}));

describe("inventory session helpers", () => {
  it("creates a session and snapshots all active rows in scope", async () => {
    const inventorySessionFindFirstMock = vi.fn().mockResolvedValue(null);
    const itemFindManyMock = vi.fn().mockResolvedValue([
      {
        id: "item-1",
        labelCode: "EL-KB-001",
        name: "Kabel 1",
        unit: "M",
        storageArea: "A",
        bin: "1",
        stock: 1250
      },
      {
        id: "item-2",
        labelCode: "EL-KB-002",
        name: "Kabel 2",
        unit: "STK",
        storageArea: "A",
        bin: "2",
        stock: 4
      }
    ]);
    const inventorySessionCreateMock = vi.fn().mockResolvedValue({
      id: "session-1",
      title: "Schrank Nord",
      status: "OPEN",
      storageLocationId: "loc-1",
      storageArea: "A",
      ownerUserId: "user-1",
      createdByUserId: "user-1",
      note: "Fruehschicht",
      createdAt: new Date("2026-03-30T08:00:00Z"),
      updatedAt: new Date("2026-03-30T08:00:00Z"),
      storageLocation: {
        id: "loc-1",
        name: "Werkstatt",
        code: "WERK"
      },
      ownerUser: {
        id: "user-1",
        name: "Ada",
        email: "ada@example.com"
      },
      createdByUser: {
        id: "user-1",
        name: "Ada",
        email: "ada@example.com"
      }
    });
    const inventorySessionRowCreateManyMock = vi.fn().mockResolvedValue({ count: 2 });

    const result = await createInventorySession(
      {
        storageLocation: {
          findUnique: vi.fn().mockResolvedValue({
            id: "loc-1",
            name: "Werkstatt",
            code: "WERK"
          })
        },
        storageShelf: {
          findFirst: vi.fn().mockResolvedValue({ id: "shelf-1" })
        },
        inventorySession: {
          findFirst: inventorySessionFindFirstMock,
          create: inventorySessionCreateMock
        },
        inventorySessionRow: {
          createMany: inventorySessionRowCreateManyMock
        },
        item: {
          findMany: itemFindManyMock
        },
        reservation: {
          groupBy: vi.fn()
        },
        stockMovement: {
          create: vi.fn()
        },
        auditLog: {
          create: vi.fn()
        }
      } as never,
      {
        storageLocationId: "loc-1",
        storageArea: "A",
        title: "Schrank Nord",
        note: "Fruehschicht",
        ownerUserId: "user-1",
        createdByUserId: "user-1",
        allowedLocationIds: ["loc-1"]
      }
    );

    expect(result.id).toBe("session-1");
    expect(inventorySessionFindFirstMock).toHaveBeenCalledWith({
      where: {
        storageLocationId: "loc-1",
        status: "OPEN"
      },
      select: { id: true }
    });
    expect(itemFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storageLocationId: "loc-1",
          storageArea: "A",
          deletedAt: null,
          isArchived: false
        })
      })
    );
    expect(inventorySessionRowCreateManyMock).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sessionId: "session-1",
          itemId: "item-1",
          expectedStock: 1250
        }),
        expect.objectContaining({
          sessionId: "session-1",
          itemId: "item-2",
          expectedStock: 4
        })
      ]
    });
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INVENTORY_SESSION_CREATE",
        entityId: "session-1"
      }),
      expect.any(Object)
    );
  });

  it("stores meter counts in millimeters while editing a session", async () => {
    const inventorySessionRowUpdateMock = vi.fn().mockResolvedValue({});

    const result = await updateInventorySessionCounts(
      {
        inventorySession: {
          findUnique: vi.fn().mockResolvedValue({
            id: "session-1",
            status: "OPEN",
            storageLocationId: "loc-1",
            ownerUserId: "user-1",
            rows: [
              {
                id: "row-1",
                itemId: "item-1",
                labelCode: "EL-KB-001",
                unit: "M",
                countedStock: null,
                countedAt: null,
                countedByUserId: null,
                note: null
              }
            ]
          })
        },
        inventorySessionRow: {
          update: inventorySessionRowUpdateMock
        },
        storageLocation: {
          findUnique: vi.fn()
        },
        storageShelf: {
          findFirst: vi.fn()
        },
        item: {
          findMany: vi.fn()
        },
        reservation: {
          groupBy: vi.fn()
        },
        stockMovement: {
          create: vi.fn()
        },
        auditLog: {
          create: vi.fn()
        }
      } as never,
      {
        sessionId: "session-1",
        counts: [
          {
            itemId: "item-1",
            countedStock: 1.25,
            note: "Nachgezaehlt"
          }
        ],
        viewer: {
          id: "user-1",
          role: "READ_WRITE"
        },
        allowedLocationIds: ["loc-1"]
      }
    );

    expect(result).toEqual({ updatedCount: 1 });
    expect(inventorySessionRowUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "row-1" },
        data: expect.objectContaining({
          countedStock: 1250,
          countedByUserId: "user-1",
          note: "Nachgezaehlt"
        })
      })
    );
  });

  it("finalizes only counted rows and leaves untouched rows unchanged", async () => {
    const itemUpdateMock = vi.fn().mockResolvedValue({});
    const stockMovementCreateMock = vi.fn().mockResolvedValue({});
    const inventorySessionUpdateMock = vi.fn().mockResolvedValue({
      id: "session-1",
      status: "FINALIZED",
      finalizedAt: new Date("2026-03-30T12:00:00Z")
    });

    const result = await finalizeInventorySession(
      {
        inventorySession: {
          findUnique: vi.fn().mockResolvedValue({
            id: "session-1",
            title: "Schrank Nord",
            status: "OPEN",
            storageLocationId: "loc-1",
            storageArea: "A",
            ownerUserId: "user-1",
            storageLocation: {
              id: "loc-1",
              name: "Werkstatt",
              code: "WERK"
            },
            ownerUser: {
              id: "user-1",
              name: "Ada",
              email: "ada@example.com"
            },
            createdByUser: null,
            rows: [
              {
                id: "row-1",
                itemId: "item-1",
                labelCode: "EL-KB-001",
                name: "Kabel 1",
                unit: "M",
                expectedStock: 1250,
                countedStock: 1500,
                note: "neu gemessen",
                item: {
                  id: "item-1",
                  labelCode: "EL-KB-001",
                  name: "Kabel 1",
                  unit: "M",
                  stock: 1000,
                  storageArea: "A",
                  bin: "1",
                  deletedAt: null,
                  isArchived: false
                }
              },
              {
                id: "row-2",
                itemId: "item-2",
                labelCode: "EL-KB-002",
                name: "Stecker",
                unit: "STK",
                expectedStock: 4,
                countedStock: null,
                note: null,
                item: {
                  id: "item-2",
                  labelCode: "EL-KB-002",
                  name: "Stecker",
                  unit: "STK",
                  stock: 4,
                  storageArea: "A",
                  bin: "2",
                  deletedAt: null,
                  isArchived: false
                }
              }
            ]
          }),
          update: inventorySessionUpdateMock
        },
        inventorySessionRow: {
          update: vi.fn()
        },
        item: {
          update: itemUpdateMock
        },
        reservation: {
          groupBy: vi.fn().mockResolvedValue([
            {
              itemId: "item-1",
              _sum: {
                reservedQty: 200
              }
            }
          ])
        },
        stockMovement: {
          create: stockMovementCreateMock
        },
        storageLocation: {
          findUnique: vi.fn()
        },
        storageShelf: {
          findFirst: vi.fn()
        },
        auditLog: {
          create: vi.fn()
        }
      } as never,
      {
        sessionId: "session-1",
        viewer: {
          id: "user-1",
          role: "READ_WRITE"
        },
        allowedLocationIds: ["loc-1"]
      }
    );

    expect(result.countedRows).toBe(1);
    expect(result.changedRows).toBe(1);
    expect(itemUpdateMock).toHaveBeenCalledTimes(1);
    expect(itemUpdateMock).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { stock: 1500 }
    });
    expect(stockMovementCreateMock).toHaveBeenCalledTimes(1);
    expect(stockMovementCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: "item-1",
          inventorySessionId: "session-1",
          delta: 500,
          reason: "INVENTORY"
        })
      })
    );
    expect(inventorySessionUpdateMock).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: {
        status: "FINALIZED",
        finalizedAt: expect.any(Date)
      }
    });
  });

  it("blocks finalization when the counted stock would undercut reservations", async () => {
    await expect(
      finalizeInventorySession(
        {
          inventorySession: {
            findUnique: vi.fn().mockResolvedValue({
              id: "session-1",
              title: "Schrank Nord",
              status: "OPEN",
              storageLocationId: "loc-1",
              storageArea: "A",
              ownerUserId: "user-1",
              storageLocation: {
                id: "loc-1",
                name: "Werkstatt",
                code: "WERK"
              },
              ownerUser: {
                id: "user-1",
                name: "Ada",
                email: "ada@example.com"
              },
              createdByUser: null,
              rows: [
                {
                  id: "row-1",
                  itemId: "item-1",
                  labelCode: "EL-KB-001",
                  name: "Kabel 1",
                  unit: "STK",
                  expectedStock: 10,
                  countedStock: 4,
                  note: null,
                  item: {
                    id: "item-1",
                    labelCode: "EL-KB-001",
                    name: "Kabel 1",
                    unit: "STK",
                    stock: 10,
                    storageArea: "A",
                    bin: "1",
                    deletedAt: null,
                    isArchived: false
                  }
                }
              ]
            }),
            update: vi.fn()
          },
          inventorySessionRow: {
            update: vi.fn()
          },
          item: {
            update: vi.fn()
          },
          reservation: {
            groupBy: vi.fn().mockResolvedValue([
              {
                itemId: "item-1",
                _sum: {
                  reservedQty: 5
                }
              }
            ])
          },
          stockMovement: {
            create: vi.fn()
          },
          storageLocation: {
            findUnique: vi.fn()
          },
          storageShelf: {
            findFirst: vi.fn()
          },
          auditLog: {
            create: vi.fn()
          }
        } as never,
        {
          sessionId: "session-1",
          viewer: {
            id: "user-1",
            role: "READ_WRITE"
          },
          allowedLocationIds: ["loc-1"]
        }
      )
    ).rejects.toMatchObject({
      code: "INVENTORY_SESSION_BLOCKED"
    });
  });
});
