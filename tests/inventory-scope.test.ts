import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireWriteAccessMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const createMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("Inventory scope enforcement", () => {
  it("rejects inventory updates for items outside the caller scope", async () => {
    const itemId = "33333333-3333-4333-8333-333333333333";

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-allowed"]);
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        item: { findUnique: findUniqueMock, update: updateMock },
        stockMovement: { create: createMock }
      })
    );
    findUniqueMock.mockResolvedValue({
      id: itemId,
      stock: 4,
      storageLocationId: "loc-forbidden"
    });

    const { POST } = await import("@/app/api/inventory/route");
    const request = new NextRequest(
      new Request("http://localhost/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          updates: [{ itemId, countedStock: 7 }]
        })
      })
    );

    const response = await POST(request);
    expect(response).toBeDefined();
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(updateMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});
