import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const transactionMock = vi.fn();
const syncTechnicalFieldScopeAssignmentMock = vi.fn();

class MockTechnicalFieldAssignmentError extends Error {}

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock
  }
}));

vi.mock("@/lib/technical-field-assignments", () => ({
  syncTechnicalFieldScopeAssignment: syncTechnicalFieldScopeAssignmentMock,
  TechnicalFieldAssignmentError: MockTechnicalFieldAssignmentError
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("custom field preset apply route", () => {
  it("returns synchronized managed field details", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    transactionMock.mockImplementation(async (callback: (db: object) => Promise<unknown>) => callback({}));
    syncTechnicalFieldScopeAssignmentMock.mockResolvedValue({
      assignment: {
        id: "assignment-1",
        categoryId: "11111111-1111-4111-8111-111111111111",
        typeId: "22222222-2222-4222-8222-222222222222",
        presetKey: "resistor"
      },
      fields: [
        { id: "field-1", name: "Wert" },
        { id: "field-2", name: "Toleranz" }
      ],
      createdFieldIds: ["field-1"],
      reactivatedFieldIds: ["field-2"],
      deactivatedFieldIds: ["field-legacy"]
    });

    const { POST } = await import("@/app/api/admin/custom-fields/presets/apply/route");
    const request = new NextRequest(
      new Request("http://localhost/api/admin/custom-fields/presets/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presetKey: "resistor",
          categoryId: "11111111-1111-4111-8111-111111111111",
          typeId: "22222222-2222-4222-8222-222222222222"
        })
      })
    );

    const response = await POST(request);
    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.created).toEqual(["Wert"]);
    expect(payload.reactivated).toEqual(["Toleranz"]);
    expect(payload.deactivatedFieldIds).toEqual(["field-legacy"]);
    expect(syncTechnicalFieldScopeAssignmentMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        presetKey: "resistor",
        categoryId: "11111111-1111-4111-8111-111111111111",
        typeId: "22222222-2222-4222-8222-222222222222"
      })
    );
  });
});
