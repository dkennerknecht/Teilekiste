import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const transactionMock = vi.fn();
const findUniqueMock = vi.fn();
const syncTechnicalFieldScopeAssignmentMock = vi.fn();
const removeTechnicalFieldScopeAssignmentMock = vi.fn();
const listTechnicalFieldScopeAssignmentsMock = vi.fn();
const customFieldFindManyMock = vi.fn();

class MockTechnicalFieldAssignmentError extends Error {}

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    technicalFieldScopeAssignment: {
      findUnique: findUniqueMock
    },
    customField: {
      findMany: customFieldFindManyMock
    }
  }
}));

vi.mock("@/lib/technical-field-assignments", () => ({
  listTechnicalFieldScopeAssignments: listTechnicalFieldScopeAssignmentsMock,
  removeTechnicalFieldScopeAssignment: removeTechnicalFieldScopeAssignmentMock,
  syncTechnicalFieldScopeAssignment: syncTechnicalFieldScopeAssignmentMock,
  TechnicalFieldAssignmentError: MockTechnicalFieldAssignmentError
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("technical field assignments route", () => {
  it("creates a managed technical assignment", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    transactionMock.mockImplementation(async (callback: (db: object) => Promise<unknown>) => callback({ tx: true }));
    syncTechnicalFieldScopeAssignmentMock.mockResolvedValue({
      assignment: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      createdFieldIds: ["field-1"],
      reactivatedFieldIds: [],
      deactivatedFieldIds: []
    });

    const { POST } = await import("@/app/api/admin/technical-field-assignments/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/admin/technical-field-assignments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            categoryId: "11111111-1111-4111-8111-111111111111",
            typeId: "22222222-2222-4222-8222-222222222222",
            presetKey: "resistor"
          })
        })
      )
    );

    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(201);
    expect(syncTechnicalFieldScopeAssignmentMock).toHaveBeenCalledWith(
      { tx: true },
      {
        categoryId: "11111111-1111-4111-8111-111111111111",
        typeId: "22222222-2222-4222-8222-222222222222",
        presetKey: "resistor"
      }
    );
  });

  it("rejects changing the assignment scope on update", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    findUniqueMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      categoryId: "11111111-1111-4111-8111-111111111111",
      typeId: "22222222-2222-4222-8222-222222222222",
      presetKey: "resistor"
    });

    const { PATCH } = await import("@/app/api/admin/technical-field-assignments/route");
    const response = await PATCH(
      new NextRequest(
        new Request("http://localhost/api/admin/technical-field-assignments", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            categoryId: "33333333-3333-4333-8333-333333333333",
            typeId: "22222222-2222-4222-8222-222222222222",
            presetKey: "capacitor"
          })
        })
      )
    );

    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(400);
    expect(syncTechnicalFieldScopeAssignmentMock).not.toHaveBeenCalled();
  });

  it("removes an assignment and keeps the operation non-destructive", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    transactionMock.mockImplementation(async (callback: (db: object) => Promise<unknown>) => callback({ tx: true }));
    removeTechnicalFieldScopeAssignmentMock.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    });

    const { DELETE } = await import("@/app/api/admin/technical-field-assignments/route");
    const response = await DELETE(
      new NextRequest(
        new Request("http://localhost/api/admin/technical-field-assignments", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
          })
        })
      )
    );

    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(200);
    expect(removeTechnicalFieldScopeAssignmentMock).toHaveBeenCalledWith(
      { tx: true },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
    );
  });
});
