import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customField: {
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn()
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("admin custom fields route", () => {
  it("rejects updates to managed technical fields", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    findUniqueMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Wert",
      categoryId: "11111111-1111-4111-8111-111111111111",
      typeId: "22222222-2222-4222-8222-222222222222",
      managedPresetFieldKey: "resistance-value"
    });

    const { PATCH } = await import("@/app/api/admin/custom-fields/route");
    const response = await PATCH(
      new NextRequest(
        new Request("http://localhost/api/admin/custom-fields", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            name: "Widerstandswert"
          })
        })
      )
    );

    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(409);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects deleting managed technical fields", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    findUniqueMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      managedPresetFieldKey: "resistance-value"
    });

    const { DELETE } = await import("@/app/api/admin/custom-fields/route");
    const response = await DELETE(
      new NextRequest(
        new Request("http://localhost/api/admin/custom-fields", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
          })
        })
      )
    );

    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(409);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
