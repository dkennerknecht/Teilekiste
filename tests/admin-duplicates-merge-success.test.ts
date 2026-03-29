import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const transactionMock = vi.fn();
const performDuplicateMergeMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock
  }
}));

vi.mock("@/lib/item-merge", async () => {
  const actual = await vi.importActual<typeof import("@/lib/item-merge")>("@/lib/item-merge");
  return {
    ...actual,
    performDuplicateMerge: performDuplicateMergeMock
  };
});

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("admin duplicate merge success route", () => {
  it("returns the merge result on success", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    performDuplicateMergeMock.mockResolvedValue({
      targetItemId: "target-1",
      sourceItemId: "source-1",
      targetLabelCode: "EL-MC-011",
      sourceLabelCode: "EL-MC-010"
    });
    transactionMock.mockImplementation(async (callback: (db: any) => Promise<unknown>) => callback({}));

    const { POST } = await import("@/app/api/admin/duplicates/merge/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/admin/duplicates/merge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceItemId: "11111111-1111-4111-8111-111111111111",
            targetItemId: "22222222-2222-4222-8222-222222222222",
            fieldSelections: { name: "target" },
            customFieldSelections: {}
          })
        })
      )
    );

    expect(response).toBeDefined();
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(201);
    expect(performDuplicateMergeMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      targetItemId: "target-1",
      sourceItemId: "source-1",
      targetLabelCode: "EL-MC-011",
      sourceLabelCode: "EL-MC-010"
    });
  });
});
