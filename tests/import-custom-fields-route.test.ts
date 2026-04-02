import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const assignNextLabelCodeMock = vi.fn();
const auditLogMock = vi.fn();
const transactionMock = vi.fn();
const categoryFindManyMock = vi.fn();
const storageLocationFindManyMock = vi.fn();
const storageLocationFindUniqueMock = vi.fn();
const storageShelfFindManyMock = vi.fn();
const storageShelfFindUniqueMock = vi.fn();
const customFieldFindManyMock = vi.fn();
const importProfileFindManyMock = vi.fn();
const labelTypeFindManyMock = vi.fn();
const itemFindManyMock = vi.fn();
const itemCustomFieldValueFindManyMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
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
    category: { findMany: categoryFindManyMock },
    storageLocation: { findMany: storageLocationFindManyMock, findUnique: storageLocationFindUniqueMock },
    storageShelf: { findMany: storageShelfFindManyMock, findUnique: storageShelfFindUniqueMock },
    customField: { findMany: customFieldFindManyMock },
    importProfile: { findMany: importProfileFindManyMock },
    labelType: { findMany: labelTypeFindManyMock },
    item: { findMany: itemFindManyMock },
    itemCustomFieldValue: { findMany: itemCustomFieldValueFindManyMock },
    $transaction: transactionMock
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("import route custom fields", () => {
  it("canonicalizes imported custom field values before persisting them", async () => {
    const categoryId = "11111111-1111-4111-8111-111111111111";
    const typeId = "22222222-2222-4222-8222-222222222222";
    const locationId = "33333333-3333-4333-8333-333333333333";
    const shelfId = "55555555-1111-4111-8111-555555555555";
    const customFieldId = "44444444-4444-4444-8444-444444444444";
    const tx = {
      storageLocation: {
        findUnique: vi.fn().mockResolvedValue({
          id: locationId
        })
      },
      storageShelf: {
        findUnique: vi.fn().mockResolvedValue({
          id: shelfId,
          name: "Regal A",
          code: "SB1",
          description: null,
          mode: "OPEN_AREA",
          storageLocationId: locationId
        })
      },
      customField: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: customFieldId,
            name: "Farbe",
            key: "farbe",
            type: "TEXT",
            unit: null,
            options: null,
            valueCatalog: JSON.stringify([
              { value: "Rot", aliases: ["red", "rot"], sortOrder: 0 },
              { value: "Blau", aliases: ["blue"], sortOrder: 1 }
            ]),
            sortOrder: 0,
            required: false,
            isActive: true,
            categoryId,
            typeId: null
          }
        ])
      },
      item: {
        create: vi.fn().mockResolvedValue({
          id: "item-1",
          labelCode: "EL-KB-001",
          name: "Kabel",
          stock: 12500,
          unit: "M",
          minStock: null
        })
      },
      itemCustomFieldValue: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({})
      },
      stockMovement: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    requireAdminMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue([locationId]);
    assignNextLabelCodeMock.mockResolvedValue("EL-KB-001");
    categoryFindManyMock.mockResolvedValue([{ id: categoryId, name: "Kabel", code: "KB" }]);
    storageLocationFindManyMock.mockResolvedValue([{ id: locationId, name: "Werkstatt", code: "WERK" }]);
    storageLocationFindUniqueMock.mockResolvedValue({ id: locationId, name: "Werkstatt", code: "WERK" });
    storageShelfFindManyMock.mockResolvedValue([{ id: shelfId, name: "Regal A", code: "SB1", storageLocationId: locationId }]);
    storageShelfFindUniqueMock.mockResolvedValue({
      id: shelfId,
      name: "Regal A",
      code: "SB1",
      description: null,
      mode: "OPEN_AREA",
      storageLocationId: locationId
    });
    importProfileFindManyMock.mockResolvedValue([]);
    customFieldFindManyMock.mockResolvedValue([
      {
        id: customFieldId,
        name: "Farbe",
        key: "farbe",
        type: "TEXT",
        unit: null,
        options: null,
        valueCatalog: JSON.stringify([{ value: "Rot", aliases: ["red", "rot"], sortOrder: 0 }]),
        sortOrder: 0,
        required: false,
        isActive: true,
        categoryId,
        typeId: null
      }
    ]);
    itemCustomFieldValueFindManyMock.mockResolvedValue([]);
    labelTypeFindManyMock.mockResolvedValue([{ id: typeId, code: "KB", name: "Kleinbauteil" }]);
    itemFindManyMock.mockResolvedValue([]);
    transactionMock.mockImplementation(async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx));

    const csv = ["category,storageLocation,shelfCode,name,stock,unit,farbe", "Kabel,Werkstatt,SB1,Kabelrolle,12.5,M,red"].join("\n");
    const form = new FormData();
    form.set("file", new File([csv], "import.csv", { type: "text/csv" }));
    form.set("dryRun", "0");
    form.set("typeId", typeId);

    const { POST } = await import("@/app/api/import/route");
    const request = new NextRequest(
      new Request("http://localhost/api/import", {
        method: "POST",
        body: form
      })
    );

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(tx.item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Kabelrolle",
          categoryId,
          storageLocationId: locationId,
          stock: 12500,
          unit: "M"
        })
      })
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: 12500
        })
      })
    );
    expect(tx.itemCustomFieldValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          customFieldId,
          valueJson: JSON.stringify("Rot")
        })
      })
    );
  }, 30000);
});
