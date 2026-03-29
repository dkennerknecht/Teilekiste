import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireWriteAccessMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const assignNextLabelCodeMock = vi.fn();
const auditLogMock = vi.fn();
const transactionMock = vi.fn();
const categoryFindManyMock = vi.fn();
const storageLocationFindManyMock = vi.fn();
const customFieldFindManyMock = vi.fn();
const labelTypeFindUniqueMock = vi.fn();
const itemFindManyMock = vi.fn();
const itemCustomFieldValueFindManyMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireWriteAccess: requireWriteAccessMock
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
    storageLocation: { findMany: storageLocationFindManyMock },
    customField: { findMany: customFieldFindManyMock },
    labelType: { findUnique: labelTypeFindUniqueMock },
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
    const tx = {
      customField: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "field-color",
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
            categoryId: "cat-1",
            typeId: null
          }
        ])
      },
      item: {
        create: vi.fn().mockResolvedValue({ id: "item-1", labelCode: "EL-KB-001", name: "Kabel" })
      },
      itemCustomFieldValue: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({})
      },
      stockMovement: {
        create: vi.fn().mockResolvedValue({})
      }
    };

    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    assignNextLabelCodeMock.mockResolvedValue("EL-KB-001");
    categoryFindManyMock.mockResolvedValue([{ id: "cat-1", name: "Kabel" }]);
    storageLocationFindManyMock.mockResolvedValue([{ id: "loc-1", name: "Werkstatt" }]);
    customFieldFindManyMock.mockResolvedValue([
      {
        id: "field-color",
        name: "Farbe",
        key: "farbe",
        type: "TEXT",
        unit: null,
        options: null,
        valueCatalog: JSON.stringify([{ value: "Rot", aliases: ["red", "rot"], sortOrder: 0 }]),
        sortOrder: 0,
        required: false,
        isActive: true,
        categoryId: "cat-1",
        typeId: null
      }
    ]);
    itemCustomFieldValueFindManyMock.mockResolvedValue([]);
    labelTypeFindUniqueMock.mockResolvedValue({ id: "type-1", code: "KB", name: "Kleinbauteil" });
    itemFindManyMock.mockResolvedValue([]);
    transactionMock.mockImplementation(async (callback: (db: typeof tx) => Promise<unknown>) => callback(tx));

    const csv = ["category,storageLocation,name,stock,unit,farbe", "Kabel,Werkstatt,Kabelrolle,4,M,red"].join("\n");
    const form = new FormData();
    form.set("file", new File([csv], "import.csv", { type: "text/csv" }));
    form.set("dryRun", "0");
    form.set("typeId", "type-1");

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
          categoryId: "cat-1",
          storageLocationId: "loc-1"
        })
      })
    );
    expect(tx.itemCustomFieldValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          customFieldId: "field-color",
          valueJson: JSON.stringify("Rot")
        })
      })
    );
  });
});
