import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const requireWriteAccessMock = vi.fn();
const requireAdminMock = vi.fn();
const favoriteUpsertMock = vi.fn();
const transactionMock = vi.fn();
const itemFindUniqueMock = vi.fn();
const userUpdateMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAuth: requireAuthMock,
  requireWriteAccess: requireWriteAccessMock,
  requireAdmin: requireAdminMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    favorite: {
      upsert: favoriteUpsertMock
    },
    $transaction: transactionMock,
    item: {
      findUnique: itemFindUniqueMock
    },
    user: {
      update: userUpdateMock
    },
    labelConfig: {
      findUnique: vi.fn()
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("Request validation", () => {
  it("returns 400 for invalid JSON in favorites route", async () => {
    requireAuthMock.mockResolvedValue({ user: { id: "u1", role: "READ", email: "read@example.com" } });

    const { POST } = await import("@/app/api/favorites/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/favorites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{"
        })
      )
    );
    expect(response).toBeDefined();
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
    expect(favoriteUpsertMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid inventory update payloads", async () => {
    requireWriteAccessMock.mockResolvedValue({
      user: { id: "u1", role: "READ_WRITE", email: "rw@example.com" }
    });

    const { POST } = await import("@/app/api/inventory/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/inventory", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            updates: [{ itemId: "not-a-uuid", countedStock: 3 }]
          })
        })
      )
    );
    expect(response).toBeDefined();
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid item patch JSON before touching the database", async () => {
    requireWriteAccessMock.mockResolvedValue({
      user: { id: "u1", role: "READ_WRITE", email: "rw@example.com" }
    });

    const { PATCH } = await import("@/app/api/items/[id]/route");
    const response = await PATCH(
      new NextRequest(
        new Request("http://localhost/api/items/item-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: "{"
        })
      ),
      { params: { id: "item-1" } }
    );
    expect(response).toBeDefined();
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
    expect(itemFindUniqueMock).not.toHaveBeenCalled();
  });
});
