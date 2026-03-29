import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireWriteAccessMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const auditLogMock = vi.fn();
const itemFindUniqueMock = vi.fn();
const reservationAggregateMock = vi.fn();
const reservationCountMock = vi.fn();
const stockMovementCountMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/audit", () => ({
  auditLog: auditLogMock
}));

vi.mock("@/lib/label-code", () => ({
  assignNextLabelCode: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findUnique: itemFindUniqueMock
    },
    reservation: {
      aggregate: reservationAggregateMock,
      count: reservationCountMock
    },
    stockMovement: {
      count: stockMovementCountMock
    },
    $transaction: transactionMock
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("Meter quantity routes", () => {
  it("books decimal meter movements in mm and returns meter values", async () => {
    const tx = {
      stockMovement: {
        create: vi.fn().mockResolvedValue({
          id: "movement-1",
          itemId: "item-1",
          delta: -1250,
          reason: "CONSUMPTION",
          note: "Ablängen",
          userId: "user-1"
        })
      },
      item: {
        update: vi.fn().mockResolvedValue({
          id: "item-1",
          stock: 250,
          minStock: 0,
          unit: "M"
        })
      }
    };

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    itemFindUniqueMock.mockResolvedValue({
      id: "item-1",
      stock: 1500,
      minStock: 0,
      unit: "M",
      storageLocationId: "loc-1"
    });
    reservationAggregateMock.mockResolvedValue({ _sum: { reservedQty: 250 } });
    transactionMock.mockImplementation(async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx));

    const { POST } = await import("@/app/api/items/[id]/movements/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/items/item-1/movements", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            delta: -1.25,
            reason: "CONSUMPTION",
            note: "Ablängen"
          })
        })
      ),
      { params: { id: "item-1" } }
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("POST returned no response");
    }

    expect(response.status).toBe(200);
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: -1250
        })
      })
    );
    await expect(response.json()).resolves.toEqual({
      movement: expect.objectContaining({
        delta: -1.25
      }),
      item: expect.objectContaining({
        stock: 0.25,
        minStock: 0
      })
    });
  });

  it("creates decimal meter reservations in mm and returns meter values", async () => {
    const tx = {
      reservation: {
        create: vi.fn().mockResolvedValue({
          id: "reservation-1",
          itemId: "item-1",
          reservedQty: 400,
          reservedFor: "Werkbank",
          note: null,
          userId: "user-1"
        })
      }
    };

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    itemFindUniqueMock.mockResolvedValue({
      id: "item-1",
      stock: 2500,
      unit: "M",
      storageLocationId: "loc-1"
    });
    reservationAggregateMock.mockResolvedValue({ _sum: { reservedQty: 500 } });
    transactionMock.mockImplementation(async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx));

    const { POST } = await import("@/app/api/items/[id]/reservations/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/items/item-1/reservations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reservedQty: 0.4,
            reservedFor: "Werkbank"
          })
        })
      ),
      { params: { id: "item-1" } }
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("POST returned no response");
    }

    expect(response.status).toBe(201);
    expect(tx.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reservedQty: 400
        })
      })
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        reservedQty: 0.4,
        reservedFor: "Werkbank"
      })
    );
  });

  it("blocks switching to or from meter units once history exists", async () => {
    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    itemFindUniqueMock.mockResolvedValue({
      id: "item-1",
      labelCode: "EL-KB-001",
      categoryId: "cat-1",
      storageLocationId: "loc-1",
      stock: 5,
      unit: "STK",
      minStock: 1
    });
    reservationAggregateMock.mockResolvedValue({ _sum: { reservedQty: 0 } });
    stockMovementCountMock.mockResolvedValue(1);
    reservationCountMock.mockResolvedValue(0);

    const { PATCH } = await import("@/app/api/items/[id]/route");
    const response = await PATCH(
      {
        json: vi.fn().mockResolvedValue({
          unit: "M"
        })
      } as unknown as NextRequest,
      { params: { id: "item-1" } }
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("PATCH returned no response");
    }

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Einheitenwechsel ist nur moeglich, solange noch keine Bewegungen oder Reservierungen existieren"
    });
  });
});
