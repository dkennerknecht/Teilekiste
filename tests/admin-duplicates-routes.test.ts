import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const itemFindManyMock = vi.fn();
const itemFindUniqueMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAdmin: requireAdminMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: itemFindManyMock,
      findUnique: itemFindUniqueMock
    },
    $transaction: transactionMock
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

function createMergeableItem(input: Partial<any>) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    labelCode: "EL-MC-001",
    name: "ESP32 DevKit V1",
    description: "",
    categoryId: "cat-1",
    typeId: "type-mc",
    storageLocationId: "loc-1",
    storageArea: null,
    bin: null,
    stock: 5,
    unit: "STK",
    minStock: 1,
    manufacturer: "Espressif",
    mpn: "ESP32-DEVKIT-V1",
    datasheetUrl: null,
    purchaseUrl: null,
    isArchived: false,
    deletedAt: null,
    mergedIntoItemId: null,
    mergedAt: null,
    category: { id: "cat-1", name: "Elektronik", code: "EL" },
    labelType: { id: "type-mc", code: "MC", name: "Mikrocontroller" },
    storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
    tags: [],
    images: [],
    attachments: [],
    movements: [],
    reservations: [],
    favorites: [],
    recentViews: [],
    customValues: [],
    bomChildren: [],
    bomParents: [],
    ...input
  };
}

describe("admin duplicate routes", () => {
  it("lists duplicate pairs with score and reasons", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    itemFindManyMock.mockResolvedValue([
      createMergeableItem({ id: "11111111-1111-4111-8111-111111111111", labelCode: "EL-MC-001" }),
      createMergeableItem({ id: "22222222-2222-4222-8222-222222222222", labelCode: "EL-MC-002" })
    ]);

    const { GET } = await import("@/app/api/admin/duplicates/route");
    const response = await GET(new NextRequest("http://localhost/api/admin/duplicates"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        total: 1,
        items: [
          expect.objectContaining({
            score: expect.any(Number),
            reasons: expect.arrayContaining(["Gleicher Hersteller + gleiche MPN", "Gleicher Name"]),
            mergeEligible: true
          })
        ]
      })
    );
  });

  it("does not list duplicate pairs when storage locations differ", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    itemFindManyMock.mockResolvedValue([
      createMergeableItem({ id: "11111111-1111-4111-8111-111111111111", labelCode: "EL-MC-001", manufacturer: null, mpn: null, storageLocationId: "loc-1" }),
      createMergeableItem({ id: "22222222-2222-4222-8222-222222222222", labelCode: "EL-MC-002", manufacturer: null, mpn: null, storageLocationId: "loc-2" })
    ]);

    const { GET } = await import("@/app/api/admin/duplicates/route");
    const response = await GET(new NextRequest("http://localhost/api/admin/duplicates"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        total: 0,
        items: []
      })
    );
  });

  it("blocks preview when merge would create a BOM self reference", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    itemFindUniqueMock
      .mockResolvedValueOnce(
        createMergeableItem({
          id: "11111111-1111-4111-8111-111111111111",
          labelCode: "EL-MC-010",
          bomChildren: [
            {
              id: "bom-1",
              parentItemId: "11111111-1111-4111-8111-111111111111",
              childItemId: "22222222-2222-4222-8222-222222222222",
              qty: 1
            }
          ]
        })
      )
      .mockResolvedValueOnce(createMergeableItem({ id: "22222222-2222-4222-8222-222222222222", labelCode: "EL-MC-011" }));

    const { POST } = await import("@/app/api/admin/duplicates/preview/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/admin/duplicates/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceItemId: "11111111-1111-4111-8111-111111111111",
            targetItemId: "22222222-2222-4222-8222-222222222222"
          })
        })
      )
    );

    expect(response).toBeDefined();
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Merge wuerde eine ungueltige BOM-Selbstreferenz erzeugen"
    });
  });

  it("blocks merge requests for non-eligible pairs", async () => {
    requireAdminMock.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com" }
    });
    transactionMock.mockImplementation(async (callback: (db: any) => Promise<unknown>) =>
      callback({
        item: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce(
              createMergeableItem({
                id: "11111111-1111-4111-8111-111111111111",
                labelCode: "EL-MC-010",
                unit: "STK"
              })
            )
            .mockResolvedValueOnce(
              createMergeableItem({
                id: "22222222-2222-4222-8222-222222222222",
                labelCode: "EL-MC-011",
                unit: "M"
              })
            )
        }
      })
    );

    const { POST } = await import("@/app/api/admin/duplicates/merge/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/admin/duplicates/merge", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceItemId: "11111111-1111-4111-8111-111111111111",
            targetItemId: "22222222-2222-4222-8222-222222222222",
            fieldSelections: {},
            customFieldSelections: {}
          })
        })
      )
    );

    expect(response).toBeDefined();
    if (!response) throw new Error("Expected response");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Merge nur bei gleicher Einheit moeglich"
    });
  });
});
