import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const requireWriteAccessMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAuth: requireAuthMock,
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findUnique: findUniqueMock
    },
    labelConfig: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn()
}));

vi.mock("@/lib/label-code", () => ({
  assignNextLabelCode: vi.fn()
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("Item scope enforcement", () => {
  it("rejects moving an item to a target location outside the caller scope", async () => {
    const allowedLocationId = "11111111-1111-4111-8111-111111111111";
    const forbiddenLocationId = "22222222-2222-4222-8222-222222222222";

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue([allowedLocationId]);
    findUniqueMock.mockResolvedValue({
      id: "item-1",
      labelCode: "EL-KB-001",
      storageLocationId: allowedLocationId
    });

    const { PATCH } = await import("@/app/api/items/[id]/route");
    const request = {
      json: vi.fn().mockResolvedValue({
        storageLocationId: forbiddenLocationId
      })
    } as unknown as NextRequest;

    const response = await PATCH(request, { params: { id: "item-1" } });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });
});
