import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireWriteAccessMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const assignNextLabelCodeMock = vi.fn();
const auditLogMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireWriteAccess: requireWriteAccessMock,
  requireAuth: vi.fn()
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/label-code", () => ({
  assignNextLabelCode: assignNextLabelCodeMock
}));

vi.mock("@/lib/audit", () => ({
  auditLog: auditLogMock
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

describe("Item create transaction", () => {
  it("creates the item, stock movement, and audit log inside one transaction context", async () => {
    const tx = {
      item: {
        create: vi.fn().mockResolvedValue({ id: "item-1", labelCode: "EL-KB-001", name: "ESP32" })
      },
      itemCustomFieldValue: {
        upsert: vi.fn().mockResolvedValue({})
      },
      stockMovement: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["11111111-1111-4111-8111-111111111111"]);
    assignNextLabelCodeMock.mockResolvedValue("EL-KB-001");
    transactionMock.mockImplementation(async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx));

    const { POST } = await import("@/app/api/items/route");
    const request = new NextRequest(
      new Request("http://localhost/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "ESP32",
          description: "",
          categoryId: "22222222-2222-4222-8222-222222222222",
          storageLocationId: "11111111-1111-4111-8111-111111111111",
          stock: 5,
          unit: "STK",
          minStock: 1,
          manufacturer: "Espressif",
          mpn: "ESP32-DEVKIT-V1",
          barcodeEan: "123456789",
          typeId: "44444444-4444-4444-8444-444444444444",
          tagIds: ["55555555-5555-4555-8555-555555555555"],
          customValues: {
            "66666666-6666-4666-8666-666666666666": "3.3V"
          }
        })
      })
    );

    const response = await POST(request);
    expect(response).toBeDefined();
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(201);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(assignNextLabelCodeMock).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      "44444444-4444-4444-8444-444444444444",
      tx
    );
    expect(tx.item.create).toHaveBeenCalledTimes(1);
    expect(tx.itemCustomFieldValue.upsert).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ITEM_CREATE",
        entityId: "item-1"
      }),
      tx
    );
  });
});
