import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const storageLocationFindManyMock = vi.fn();
const storageShelfFindManyMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireAuth: requireAuthMock
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    storageLocation: {
      findMany: storageLocationFindManyMock
    },
    storageShelf: {
      findMany: storageShelfFindManyMock
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("storage overview route", () => {
  it("returns grouped shelf and drawer contents with combined drawer labels", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    storageLocationFindManyMock.mockResolvedValue([
      { id: "loc-1", name: "Werkstatt", code: "WERK" }
    ]);
    storageShelfFindManyMock.mockResolvedValue([
      {
        id: "shelf-open",
        code: "AB",
        name: "Automaten",
        description: "LS und FI",
        mode: "OPEN_AREA",
        storageLocationId: "loc-1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        items: [
          {
            id: "item-1",
            labelCode: "EL-SI-001",
            name: "LS B16",
            unit: "STK",
            stock: 5,
            incomingQty: 0,
            placementStatus: "PLACED",
            binSlot: null,
            images: [
              {
                path: "/data/uploads/item-1/photo.jpg",
                thumbPath: "/data/uploads/item-1/thumb-photo.jpg",
                caption: "LS B16",
                isPrimary: true
              }
            ],
            reservations: [{ reservedQty: 1 }]
          }
        ],
        bins: []
      },
      {
        id: "shelf-drawer",
        code: "CD",
        name: "Klemmen",
        description: null,
        mode: "DRAWER_HOST",
        storageLocationId: "loc-1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        items: [],
        bins: [
          {
            id: "bin-1",
            code: "01",
            slotCount: 2,
            items: [
              {
                id: "item-2",
                labelCode: "EL-KL-001",
                name: "Wago 221",
                unit: "STK",
                stock: 10,
                incomingQty: 0,
                placementStatus: "PLACED",
                binSlot: 2,
                images: [],
                reservations: []
              }
            ]
          },
          {
            id: "bin-2",
            code: "02",
            slotCount: 1,
            items: []
          }
        ]
      }
    ]);

    const { GET } = await import("@/app/api/storage-overview/route");
    const response = await GET(
      new NextRequest(new Request("http://localhost/api/storage-overview"))
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          locationCount: 1,
          shelfCount: 2,
          drawerCount: 2,
          itemCount: 2
        }),
        locations: [
          expect.objectContaining({
            id: "loc-1",
            shelves: expect.arrayContaining([
              expect.objectContaining({
                id: "shelf-open",
                displayCode: "AB",
                items: [
                  expect.objectContaining({
                    id: "item-1",
                    displayPosition: "Werkstatt / AB",
                    availableStock: 4,
                    primaryImage: expect.objectContaining({
                      path: "/data/uploads/item-1/photo.jpg",
                      thumbPath: "/data/uploads/item-1/thumb-photo.jpg"
                    })
                  })
                ]
              }),
              expect.objectContaining({
                id: "shelf-drawer",
                bins: expect.arrayContaining([
                  expect.objectContaining({
                    id: "bin-1",
                    fullCode: "CD01",
                    summary: expect.objectContaining({
                      occupiedCount: 1,
                      freeSlotCount: 1
                    }),
                    items: [
                      expect.objectContaining({
                        id: "item-2",
                        displayPosition: "Werkstatt / CD01-2"
                      })
                    ]
                  }),
                  expect.objectContaining({
                    id: "bin-2",
                    fullCode: "CD02"
                  })
                ])
              })
            ])
          })
        ]
      })
    );
  });

  it("filters drawers and hides empty drawers and shelves on demand", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    storageLocationFindManyMock.mockResolvedValue([
      { id: "loc-1", name: "Werkstatt", code: "WERK" }
    ]);
    storageShelfFindManyMock.mockResolvedValue([
      {
        id: "shelf-open-empty",
        code: "AB",
        name: "Automaten",
        description: "LS und FI",
        mode: "OPEN_AREA",
        storageLocationId: "loc-1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        items: [],
        bins: []
      },
      {
        id: "shelf-drawer",
        code: "CD",
        name: "Klemmen",
        description: null,
        mode: "DRAWER_HOST",
        storageLocationId: "loc-1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        items: [],
        bins: [
          {
            id: "bin-1",
            code: "01",
            slotCount: 2,
            items: [
              {
                id: "item-2",
                labelCode: "EL-KL-001",
                name: "Wago 221",
                unit: "STK",
                stock: 10,
                incomingQty: 0,
                placementStatus: "PLACED",
                binSlot: 2,
                images: [],
                reservations: []
              }
            ]
          },
          {
            id: "bin-2",
            code: "02",
            slotCount: 1,
            items: []
          }
        ]
      }
    ]);

    const { GET } = await import("@/app/api/storage-overview/route");
    const response = await GET(
      new NextRequest(
        new Request("http://localhost/api/storage-overview?drawerQuery=CD01&showEmptyDrawers=0&showEmptyShelves=0")
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          shelfCount: 1,
          drawerCount: 1,
          itemCount: 1
        }),
        locations: [
          expect.objectContaining({
            shelves: [
              expect.objectContaining({
                id: "shelf-drawer",
                bins: [
                  expect.objectContaining({
                    id: "bin-1",
                    fullCode: "CD01"
                  })
                ]
              })
            ]
          })
        ]
      })
    );
  });

  it("hides open shelves when a drawer filter is active", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1"]);
    storageLocationFindManyMock.mockResolvedValue([
      { id: "loc-1", name: "Werkstatt", code: "WERK" }
    ]);
    storageShelfFindManyMock.mockResolvedValue([
      {
        id: "shelf-open",
        code: "AB",
        name: "Automaten",
        description: null,
        mode: "OPEN_AREA",
        storageLocationId: "loc-1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        items: [
          {
            id: "item-1",
            labelCode: "EL-SI-001",
            name: "LS B16",
            unit: "STK",
            stock: 5,
            incomingQty: 0,
            placementStatus: "PLACED",
            binSlot: null,
            images: [],
            reservations: []
          }
        ],
        bins: []
      },
      {
        id: "shelf-drawer",
        code: "CD",
        name: "Klemmen",
        description: null,
        mode: "DRAWER_HOST",
        storageLocationId: "loc-1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        items: [],
        bins: [
          {
            id: "bin-1",
            code: "01",
            slotCount: 2,
            items: [
              {
                id: "item-2",
                labelCode: "EL-KL-001",
                name: "Wago 221",
                unit: "STK",
                stock: 10,
                incomingQty: 0,
                placementStatus: "PLACED",
                binSlot: 1,
                images: [],
                reservations: []
              }
            ]
          }
        ]
      }
    ]);

    const { GET } = await import("@/app/api/storage-overview/route");
    const response = await GET(
      new NextRequest(
        new Request("http://localhost/api/storage-overview?drawerQuery=CD01")
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          shelfCount: 1,
          drawerCount: 1,
          itemCount: 1
        }),
        locations: [
          expect.objectContaining({
            shelves: [
              expect.objectContaining({
                id: "shelf-drawer",
                bins: [expect.objectContaining({ fullCode: "CD01" })]
              })
            ]
          })
        ]
      })
    );
  });

  it("applies storage location and shelf filters server-side", async () => {
    requireAuthMock.mockResolvedValue({
      user: { id: "user-1", role: "ADMIN", email: "admin@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(["loc-1", "loc-2"]);
    storageLocationFindManyMock.mockResolvedValue([
      { id: "loc-1", name: "Werkstatt", code: "WERK" },
      { id: "loc-2", name: "Keller", code: "KELL" }
    ]);
    storageShelfFindManyMock.mockResolvedValue([
      {
        id: "shelf-1",
        code: "AB",
        name: "Automaten",
        description: null,
        mode: "OPEN_AREA",
        storageLocationId: "loc-1",
        storageLocation: { id: "loc-1", name: "Werkstatt", code: "WERK" },
        items: [],
        bins: []
      },
      {
        id: "shelf-2",
        code: "CD",
        name: "Verteiler",
        description: "Unterverteilung",
        mode: "OPEN_AREA",
        storageLocationId: "loc-2",
        storageLocation: { id: "loc-2", name: "Keller", code: "KELL" },
        items: [],
        bins: []
      }
    ]);

    const { GET } = await import("@/app/api/storage-overview/route");
    const response = await GET(
      new NextRequest(
        new Request("http://localhost/api/storage-overview?storageLocationId=loc-2&shelfQuery=verteil")
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          locationCount: 1,
          shelfCount: 1
        }),
        locations: [
          expect.objectContaining({
            id: "loc-2",
            shelves: [
              expect.objectContaining({
                id: "shelf-2",
                displayCode: "CD",
                name: "Verteiler"
              })
            ]
          })
        ]
      })
    );
  });
});
