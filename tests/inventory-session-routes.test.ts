import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const requireWriteAccessMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const auditLogMock = vi.fn();
const transactionMock = vi.fn();
const inventorySessionFindManyMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAuth: requireAuthMock,
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/audit", () => ({
  auditLog: auditLogMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inventorySession: {
      findMany: inventorySessionFindManyMock
    },
    $transaction: transactionMock
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("inventory session routes", () => {
  it("creates an inventory session via the API", async () => {
    const locationId = "11111111-1111-4111-8111-111111111111";
    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue([locationId]);

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        storageLocation: {
          findUnique: vi.fn().mockResolvedValue({
            id: locationId,
            name: "Werkstatt",
            code: "WERK"
          })
        },
        storageShelf: {
          findFirst: vi.fn().mockResolvedValue({ id: "shelf-1" })
        },
        inventorySession: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "session-1",
            title: "Regal A",
            status: "OPEN",
            storageLocationId: locationId,
            storageArea: "A",
            ownerUserId: "user-1",
            createdByUserId: "user-1",
            note: null,
            createdAt: new Date("2026-03-30T08:00:00Z"),
            updatedAt: new Date("2026-03-30T08:00:00Z"),
            storageLocation: {
              id: locationId,
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
          })
        },
        inventorySessionRow: {
          createMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        item: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "item-1",
              labelCode: "EL-KB-001",
              name: "Kabel",
              unit: "M",
              storageArea: "A",
              bin: "1",
              stock: 1250
            }
          ])
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
      })
    );

    const { POST } = await import("@/app/api/inventory/sessions/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/inventory/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            storageLocationId: locationId,
            storageArea: "A",
            title: "Regal A"
          })
        })
      )
    );
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        id: "session-1",
        rowCount: 1,
        storageLocationId: locationId,
        storageArea: "A"
      })
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INVENTORY_SESSION_CREATE",
        entityId: "session-1"
      }),
      expect.any(Object)
    );
  });

  it("rejects count updates from non-owners", async () => {
    const locationId = "22222222-2222-4222-8222-222222222222";
    const sessionId = "33333333-3333-4333-8333-333333333333";
    const itemId = "44444444-4444-4444-8444-444444444444";

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-2", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue([locationId]);

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        inventorySession: {
          findUnique: vi.fn().mockResolvedValue({
            id: sessionId,
            status: "OPEN",
            storageLocationId: locationId,
            ownerUserId: "user-1",
            rows: [
              {
                id: "row-1",
                itemId,
                labelCode: "EL-KB-001",
                unit: "STK",
                countedStock: null,
                countedAt: null,
                countedByUserId: null,
                note: null
              }
            ]
          })
        },
        inventorySessionRow: {
          update: vi.fn()
        },
        item: {
          findMany: vi.fn()
        },
        storageLocation: {
          findUnique: vi.fn()
        },
        storageShelf: {
          findFirst: vi.fn()
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
      })
    );

    const { POST } = await import("@/app/api/inventory/sessions/[id]/counts/route");
    const response = await POST(
      new NextRequest(
        new Request(`http://localhost/api/inventory/sessions/${sessionId}/counts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            counts: [
              {
                itemId,
                countedStock: 7
              }
            ]
          })
        })
      ),
      { params: { id: sessionId } }
    );
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
