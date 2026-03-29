import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const itemFindUniqueMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAuth: requireAuthMock,
  requireWriteAccess: vi.fn()
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findUnique: itemFindUniqueMock
    }
  }
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn()
}));

vi.mock("@/lib/label-code", () => ({
  assignNextLabelCode: vi.fn()
}));

vi.mock("@/lib/item-bom", () => ({
  loadItemBom: vi.fn()
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("merged item redirects", () => {
  it("returns the target item id for merged source items", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    itemFindUniqueMock
      .mockResolvedValueOnce({
        id: "source-1",
        mergedIntoItemId: "target-1"
      })
      .mockResolvedValueOnce({
        id: "target-1",
        storageLocationId: "loc-1"
      });

    const { GET } = await import("@/app/api/items/[id]/route");
    const response = await GET(
      new NextRequest("http://localhost/api/items/source-1"),
      { params: { id: "source-1" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ redirectToItemId: "target-1" });
  });
});
