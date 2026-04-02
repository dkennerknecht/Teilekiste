import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireWriteAccessMock = vi.fn();
const requireAuthMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const auditLogMock = vi.fn();
const assignNextLabelCodeMock = vi.fn();
const itemFindUniqueMock = vi.fn();
const itemFindManyMock = vi.fn();
const storageLocationFindUniqueMock = vi.fn();
const storageShelfFindUniqueMock = vi.fn();
const storageShelfFindFirstMock = vi.fn();
const reservationAggregateMock = vi.fn();
const reservationCountMock = vi.fn();
const stockMovementCountMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireWriteAccess: requireWriteAccessMock,
  requireAuth: requireAuthMock
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/audit", () => ({
  auditLog: auditLogMock
}));

vi.mock("@/lib/label-code", () => ({
  assignNextLabelCode: assignNextLabelCodeMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findUnique: itemFindUniqueMock,
      findMany: itemFindManyMock
    },
    storageLocation: {
      findUnique: storageLocationFindUniqueMock,
      findMany: vi.fn()
    },
    storageShelf: {
      findFirst: storageShelfFindFirstMock,
      findUnique: storageShelfFindUniqueMock
    },
    reservation: {
      aggregate: reservationAggregateMock,
      count: reservationCountMock
    },
    stockMovement: {
      count: stockMovementCountMock
    },
    $transaction: transactionMock,
    labelConfig: {
      findUnique: vi.fn()
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("item transfer routes", () => {
  it("transfers a single item without creating stock movements", async () => {
    const sourceLocationId = "11111111-1111-4111-8111-111111111111";
    const targetLocationId = "22222222-2222-4222-8222-222222222222";
    const sourceShelfId = "11111111-2222-4333-8444-555555555555";
    const targetShelfId = "66666666-2222-4333-8444-555555555555";
    const txItemUpdateMock = vi.fn().mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      labelCode: "EL-KB-001",
      name: "Steckerleiste",
      storageLocationId: targetLocationId,
      storageShelfId: targetShelfId,
      storageArea: "Zielregal",
      storageBinId: null,
      binSlot: null,
      stock: 5,
      minStock: 1,
      unit: "STK"
    });
    const txStockMovementCreateMock = vi.fn();

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    itemFindUniqueMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      labelCode: "EL-KB-001",
      name: "Steckerleiste",
      storageLocationId: sourceLocationId,
      storageShelfId: sourceShelfId,
      storageArea: "A1",
      storageBinId: null,
      binSlot: null,
      stock: 5,
      minStock: 1,
      unit: "STK",
      storageLocation: {
        id: sourceLocationId,
        name: "Werkstatt",
        code: "WERK"
      },
      storageShelf: {
        id: sourceShelfId,
        name: "A1",
        code: "SB1",
        description: null,
        mode: "OPEN_AREA",
        storageLocationId: sourceLocationId
      }
    });
    storageLocationFindUniqueMock.mockResolvedValue({
      id: targetLocationId,
      name: "Schrank 2",
      code: "SCH2"
    });
    storageShelfFindUniqueMock.mockResolvedValue({
      id: targetShelfId,
      name: "Zielregal",
      code: "SB2",
      description: null,
      mode: "OPEN_AREA",
      storageLocationId: targetLocationId
    });
    transactionMock.mockImplementation(async (callback: (db: any) => Promise<unknown>) =>
      callback({
        item: {
          update: txItemUpdateMock
        },
        storageLocation: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetLocationId,
            name: "Schrank 2",
            code: "SCH2"
          })
        },
        storageShelf: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetShelfId,
            name: "Zielregal",
            code: "SB2",
            description: null,
            mode: "OPEN_AREA",
            storageLocationId: targetLocationId
          })
        },
        stockMovement: {
          create: txStockMovementCreateMock
        }
      })
    );

    const { POST } = await import("@/app/api/items/[id]/transfer/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/items/item-1/transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storageLocationId: targetLocationId,
            storageShelfId: targetShelfId,
            note: "Von Werkbank umgelagert"
          })
        })
      ),
      { params: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }
    );
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        storageLocationId: targetLocationId,
        storageShelfId: targetShelfId,
        transferred: true
      })
    );
    expect(txItemUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        data: {
          placementStatus: "PLACED",
          storageLocationId: targetLocationId,
          storageShelfId: targetShelfId,
          storageArea: "Zielregal",
          storageBinId: null,
          binSlot: null
        }
      })
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ITEM_TRANSFER",
        entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      }),
      expect.any(Object)
    );
    expect(txStockMovementCreateMock).not.toHaveBeenCalled();
  }, 20000);

  it("returns a dry-run preview for bulk transfers with blocked items", async () => {
    const allowedSourceLocationId = "33333333-3333-4333-8333-333333333333";
    const blockedSourceLocationId = "44444444-4444-4444-8444-444444444444";
    const targetLocationId = "55555555-5555-4555-8555-555555555555";
    const targetShelfId = "99999999-2222-4333-8444-555555555555";

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue([allowedSourceLocationId, targetLocationId]);
    itemFindManyMock.mockResolvedValue([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        labelCode: "EL-KB-001",
        name: "Leitung 1",
        storageLocationId: allowedSourceLocationId,
        storageArea: "A",
        bin: "1",
        storageLocation: {
          id: allowedSourceLocationId,
          name: "Werkstatt",
          code: "WERK"
        }
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        labelCode: "EL-KB-002",
        name: "Leitung 2",
        storageLocationId: blockedSourceLocationId,
        storageArea: null,
        bin: null,
        storageLocation: {
          id: blockedSourceLocationId,
          name: "Aussenlager",
          code: "AUS"
        }
      }
    ]);
    storageLocationFindUniqueMock.mockResolvedValue({
      id: targetLocationId,
      name: "Schrank 5",
      code: "SCH5"
    });
    storageShelfFindUniqueMock.mockResolvedValue({
      id: targetShelfId,
      name: "Zielregal",
      code: "SB5",
      description: null,
      mode: "OPEN_AREA",
      storageLocationId: targetLocationId
    });

    const { POST } = await import("@/app/api/items/bulk-transfer/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/items/bulk-transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            itemIds: [
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
            ],
            storageLocationId: targetLocationId,
            storageShelfId: targetShelfId,
            dryRun: true
          })
        })
      )
    );
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        dryRun: true,
        ok: false,
        count: 2,
        transferableCount: 0,
        target: expect.objectContaining({
          storageLocationId: targetLocationId,
          storageLocationName: "Schrank 5",
          storageShelfId: targetShelfId
        }),
        blockedItems: [
          expect.objectContaining({
            itemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            reason: "Quelle ausserhalb des erlaubten Lager-Scope"
          })
        ],
        sourceGroups: expect.arrayContaining([
          expect.objectContaining({
            storageLocationId: allowedSourceLocationId,
            count: 1
          }),
          expect.objectContaining({
            storageLocationId: blockedSourceLocationId,
            count: 1
          })
        ])
      })
    );
  });

  it("executes a bulk transfer across multiple source locations", async () => {
    const sourceLocationA = "66666666-6666-4666-8666-666666666666";
    const sourceLocationB = "77777777-7777-4777-8777-777777777777";
    const targetLocationId = "88888888-8888-4888-8888-888888888888";
    const targetShelfId = "aaaaaaaa-2222-4333-8444-555555555555";
    const txItemUpdateMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        labelCode: "EL-KB-010",
        name: "Kabel 1",
        storageLocationId: targetLocationId,
        storageShelfId: targetShelfId,
        storageArea: "T1",
        storageBinId: null,
        binSlot: null,
        stock: 10,
        minStock: 1,
        unit: "M"
      })
      .mockResolvedValueOnce({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        labelCode: "EL-KB-011",
        name: "Kabel 2",
        storageLocationId: targetLocationId,
        storageShelfId: targetShelfId,
        storageArea: "T1",
        storageBinId: null,
        binSlot: null,
        stock: 8,
        minStock: 1,
        unit: "M"
      });

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    itemFindManyMock.mockResolvedValue([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        labelCode: "EL-KB-010",
        name: "Kabel 1",
        storageLocationId: sourceLocationA,
        storageArea: "A",
        bin: "1",
        storageLocation: {
          id: sourceLocationA,
          name: "Werkstatt",
          code: "WERK"
        }
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        labelCode: "EL-KB-011",
        name: "Kabel 2",
        storageLocationId: sourceLocationB,
        storageArea: "B",
        bin: "2",
        storageLocation: {
          id: sourceLocationB,
          name: "Prueffeld",
          code: "PRF"
        }
      }
    ]);
    storageLocationFindUniqueMock.mockResolvedValue({
      id: targetLocationId,
      name: "Zentrallager",
      code: "ZL"
    });
    storageShelfFindUniqueMock.mockResolvedValue({
      id: targetShelfId,
      name: "T1",
      code: "SBT1",
      description: null,
      mode: "OPEN_AREA",
      storageLocationId: targetLocationId
    });
    transactionMock.mockImplementation(async (callback: (db: any) => Promise<unknown>) =>
      callback({
        item: {
          update: txItemUpdateMock
        },
        storageLocation: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetLocationId,
            name: "Zentrallager",
            code: "ZL"
          })
        },
        storageShelf: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetShelfId,
            name: "T1",
            code: "SBT1",
            description: null,
            mode: "OPEN_AREA",
            storageLocationId: targetLocationId
          })
        }
      })
    );

    const { POST } = await import("@/app/api/items/bulk-transfer/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/items/bulk-transfer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            itemIds: [
              "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
            ],
            storageLocationId: targetLocationId,
            storageShelfId: targetShelfId,
            note: "Neu sortiert"
          })
        })
      )
    );
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        dryRun: false,
        ok: true,
        transferableCount: 2,
        transferredItems: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            labelCode: "EL-KB-010",
            name: "Kabel 1"
          },
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            labelCode: "EL-KB-011",
            name: "Kabel 2"
          }
        ]
      })
    );
    expect(auditLogMock).toHaveBeenCalledTimes(2);
    expect(auditLogMock.mock.calls.map((call) => call[0].action)).toEqual(["ITEM_TRANSFER", "ITEM_TRANSFER"]);
  });

  it("treats location-only PATCH requests as transfers", async () => {
    const sourceLocationId = "99999999-9999-4999-8999-999999999999";
    const targetLocationId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
    const sourceShelfId = "bbbbbbbb-2222-4333-8444-555555555555";
    const targetShelfId = "cccccccc-2222-4333-8444-555555555555";
    const txItemUpdateMock = vi.fn().mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      labelCode: "EL-KB-020",
      categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      storageLocationId: targetLocationId,
      storageShelfId: targetShelfId,
      storageArea: null,
      storageBinId: null,
      binSlot: null,
      stock: 4,
      minStock: 1,
      unit: "STK"
      ,
      storageShelf: {
        id: sourceShelfId,
        name: "A1",
        code: "SB1",
        description: null,
        mode: "OPEN_AREA",
        storageLocationId: sourceLocationId
      }
    });
    const txLocationFindUniqueMock = vi.fn().mockResolvedValue({
      id: targetLocationId,
      name: "Schrank 9",
      code: "SCH9"
    });
    const txLocationFindManyMock = vi.fn().mockResolvedValue([
      {
        id: sourceLocationId,
        name: "Werkstatt",
        code: "WERK"
      }
    ]);

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    storageLocationFindUniqueMock.mockResolvedValue({
      id: targetLocationId,
      name: "Schrank 9",
      code: "SCH9"
    });
    storageShelfFindUniqueMock.mockResolvedValue({
      id: targetShelfId,
      name: "Schrank 9",
      code: "SB9",
      description: null,
      mode: "OPEN_AREA",
      storageLocationId: targetLocationId
    });
    itemFindUniqueMock.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      labelCode: "EL-KB-020",
      categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      storageLocationId: sourceLocationId,
      storageShelfId: sourceShelfId,
      storageArea: "A1",
      storageBinId: null,
      binSlot: null,
      stock: 4,
      minStock: 1,
      unit: "STK",
      storageShelf: {
        id: sourceShelfId,
        name: "A1",
        code: "SB1",
        description: null,
        mode: "OPEN_AREA",
        storageLocationId: sourceLocationId
      }
    });
    reservationAggregateMock.mockResolvedValue({ _sum: { reservedQty: 0 } });
    transactionMock.mockImplementation(async (callback: (db: any) => Promise<unknown>) =>
      callback({
        item: {
          update: txItemUpdateMock
        },
        storageLocation: {
          findUnique: txLocationFindUniqueMock,
          findMany: txLocationFindManyMock
        },
        storageShelf: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetShelfId,
            name: "Schrank 9",
            code: "SB9",
            description: null,
            mode: "OPEN_AREA",
            storageLocationId: targetLocationId
          })
        }
      })
    );

    const { PATCH } = await import("@/app/api/items/[id]/route");
    const response = await PATCH(
      new NextRequest(
        new Request("http://localhost/api/items/item-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storageLocationId: targetLocationId,
            storageShelfId: targetShelfId
          })
        })
      ),
      { params: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" } }
    );
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(200);
    expect(auditLogMock).toHaveBeenCalledTimes(1);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ITEM_TRANSFER",
        entityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
      }),
      expect.any(Object)
    );
    expect(auditLogMock.mock.calls.map((call) => call[0].action)).toEqual(["ITEM_TRANSFER"]);
  });

  it("writes separate transfer and update audit entries for mixed PATCH requests", async () => {
    const sourceLocationId = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";
    const targetLocationId = "cccccccc-1111-4111-8111-cccccccccccc";
    const sourceShelfId = "dddddddd-2222-4333-8444-555555555555";
    const targetShelfId = "eeeeeeee-2222-4333-8444-555555555555";
    const txItemUpdateMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: "dddddddd-1111-4111-8111-dddddddddddd",
        labelCode: "EL-KB-021",
        categoryId: "eeeeeeee-1111-4111-8111-eeeeeeeeeeee",
        storageLocationId: targetLocationId,
        storageShelfId: targetShelfId,
        storageArea: null,
        storageBinId: null,
        binSlot: null,
        stock: 3,
        minStock: 1,
        unit: "STK",
        manufacturer: "Alt"
      })
      .mockResolvedValueOnce({
        id: "dddddddd-1111-4111-8111-dddddddddddd",
        labelCode: "EL-KB-021",
        categoryId: "eeeeeeee-1111-4111-8111-eeeeeeeeeeee",
        storageLocationId: targetLocationId,
        storageShelfId: targetShelfId,
        storageArea: null,
        storageBinId: null,
        binSlot: null,
        stock: 3,
        minStock: 1,
        unit: "STK",
        manufacturer: "Neu"
      });

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    storageLocationFindUniqueMock.mockResolvedValue({
      id: targetLocationId,
      name: "Laborregal",
      code: "LAB"
    });
    storageShelfFindUniqueMock.mockResolvedValue({
      id: targetShelfId,
      name: "Laborregal",
      code: "SBL",
      description: null,
      mode: "OPEN_AREA",
      storageLocationId: targetLocationId
    });
    itemFindUniqueMock.mockResolvedValue({
      id: "dddddddd-1111-4111-8111-dddddddddddd",
      labelCode: "EL-KB-021",
      categoryId: "eeeeeeee-1111-4111-8111-eeeeeeeeeeee",
      storageLocationId: sourceLocationId,
      storageShelfId: sourceShelfId,
      storageArea: "A2",
      storageBinId: null,
      binSlot: null,
      stock: 3,
      minStock: 1,
      unit: "STK",
      manufacturer: "Alt"
      ,
      storageShelf: {
        id: sourceShelfId,
        name: "A2",
        code: "SB2",
        description: null,
        mode: "OPEN_AREA",
        storageLocationId: sourceLocationId
      }
    });
    reservationAggregateMock.mockResolvedValue({ _sum: { reservedQty: 0 } });
    transactionMock.mockImplementation(async (callback: (db: any) => Promise<unknown>) =>
      callback({
        item: {
          update: txItemUpdateMock
        },
        itemCustomFieldValue: {
          upsert: vi.fn(),
          deleteMany: vi.fn()
        },
        storageLocation: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetLocationId,
            name: "Laborregal",
            code: "LAB"
          }),
          findMany: vi.fn().mockResolvedValue([
            {
              id: sourceLocationId,
              name: "Werkstatt",
              code: "WERK"
            }
          ])
        },
        storageShelf: {
          findUnique: vi.fn().mockResolvedValue({
            id: targetShelfId,
            name: "Laborregal",
            code: "SBL",
            description: null,
            mode: "OPEN_AREA",
            storageLocationId: targetLocationId
          })
        }
      })
    );

    const { PATCH } = await import("@/app/api/items/[id]/route");
    const response = await PATCH(
      new NextRequest(
        new Request("http://localhost/api/items/item-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storageLocationId: targetLocationId,
            storageShelfId: targetShelfId,
            manufacturer: "Neu"
          })
        })
      ),
      { params: { id: "dddddddd-1111-4111-8111-dddddddddddd" } }
    );
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(200);
    expect(auditLogMock).toHaveBeenCalledTimes(2);
    expect(auditLogMock.mock.calls.map((call) => call[0].action)).toEqual(["ITEM_TRANSFER", "ITEM_UPDATE"]);
  });
});
