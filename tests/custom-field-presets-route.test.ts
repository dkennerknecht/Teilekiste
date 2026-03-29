import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
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

describe("custom field preset apply route", () => {
  it("creates missing preset fields and skips conflicting ones", async () => {
    const tx = {
      customField: {
        findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
          return where.name === "Toleranz" ? { id: "existing-field" } : null;
        }),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: `field-${data.key}`,
          ...data,
          category: null,
          labelType: null
        }))
      }
    };

    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    transactionMock.mockImplementation(async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx));

    const { POST } = await import("@/app/api/admin/custom-fields/presets/apply/route");
    const request = new NextRequest(
      new Request("http://localhost/api/admin/custom-fields/presets/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presetKey: "resistor",
          categoryId: "11111111-1111-4111-8111-111111111111",
          typeId: null
        })
      })
    );

    const response = await POST(request);
    if (!response) throw new Error("Expected response");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.created).toContain("Wert");
    expect(payload.skipped).toContain("Toleranz");
    expect(tx.customField.create).toHaveBeenCalled();
  });
});
