import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const assignNextLabelCodeMock = vi.fn();
const auditLogMock = vi.fn();
const transactionMock = vi.fn();
const categoryFindManyMock = vi.fn();
const storageLocationFindManyMock = vi.fn();
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
    storageLocation: { findMany: storageLocationFindManyMock },
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

describe("admin import routes", () => {
  it("builds a ready preview with auto-detected mappings and profile suggestions", async () => {
    const categoryId = "11111111-1111-4111-8111-111111111111";
    const typeId = "22222222-2222-4222-8222-222222222222";
    const locationId = "33333333-3333-4333-8333-333333333333";
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue([locationId]);
    categoryFindManyMock.mockResolvedValue([{ id: categoryId, name: "Kabel", code: "KB" }]);
    storageLocationFindManyMock.mockResolvedValue([{ id: locationId, name: "Werkstatt", code: "WERK" }]);
    labelTypeFindManyMock.mockResolvedValue([{ id: typeId, name: "Kleinbauteil", code: "KB" }]);
    customFieldFindManyMock.mockResolvedValue([]);
    importProfileFindManyMock.mockResolvedValue([
      {
        id: "profile-1",
        name: "Supplier CSV",
        description: "Semikolon-CSV",
        headerFingerprint: "category|type|storagelocation|name|stock|unit",
        delimiterMode: "SEMICOLON",
        mappingConfig: JSON.stringify({ assignments: [] })
      }
    ]);
    itemFindManyMock.mockResolvedValue([]);
    itemCustomFieldValueFindManyMock.mockResolvedValue([]);

    const csv = ["Category;Type;StorageLocation;Name;Stock;Unit", "KB;KB;WERK;Leitung 2m;2.5;M"].join("\n");
    const form = new FormData();
    form.set("file", new File([csv], "supplier.csv", { type: "text/csv" }));

    const { POST } = await import("@/app/api/admin/import/preview/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/admin/import/preview", {
          method: "POST",
          body: form
        })
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        delimiterMode: "SEMICOLON",
        readyRows: 1,
        profileMatches: [expect.objectContaining({ id: "profile-1", score: 100 })],
        rows: [
          expect.objectContaining({
            status: "ready",
            resolved: expect.objectContaining({
              name: "Leitung 2m",
              unit: "M",
              stock: 2.5,
              category: expect.objectContaining({ name: "Kabel" }),
              type: expect.objectContaining({ code: "KB" }),
              storageLocation: expect.objectContaining({ code: "WERK" })
            })
          })
        ]
      })
    );
  });

  it("blocks apply when a required mapping resolves to an unknown scope value", async () => {
    const locationId = "33333333-3333-4333-8333-333333333333";
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue([locationId]);
    categoryFindManyMock.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111", name: "Kabel", code: "KB" }]);
    storageLocationFindManyMock.mockResolvedValue([{ id: locationId, name: "Werkstatt", code: "WERK" }]);
    labelTypeFindManyMock.mockResolvedValue([{ id: "22222222-2222-4222-8222-222222222222", name: "Kleinbauteil", code: "KB" }]);
    customFieldFindManyMock.mockResolvedValue([]);
    importProfileFindManyMock.mockResolvedValue([]);
    itemFindManyMock.mockResolvedValue([]);
    itemCustomFieldValueFindManyMock.mockResolvedValue([]);

    const csv = ["Category,Type,StorageLocation,Name,Stock,Unit", "Unbekannt,KB,WERK,Leitung 2m,2.5,M"].join("\n");
    const form = new FormData();
    form.set("file", new File([csv], "supplier.csv", { type: "text/csv" }));

    const { POST } = await import("@/app/api/admin/import/apply/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/admin/import/apply", {
          method: "POST",
          body: form
        })
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        created: 0,
        rows: [
          expect.objectContaining({
            status: "error",
            errors: expect.arrayContaining([
              expect.objectContaining({
                fieldKey: "category",
                message: expect.stringContaining("Kategorie unbekannt")
              })
            ])
          })
        ]
      })
    );
    expect(transactionMock).not.toHaveBeenCalled();
    expect(assignNextLabelCodeMock).not.toHaveBeenCalled();
  });
});
