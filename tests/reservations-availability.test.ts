import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireWriteAccessMock = vi.fn();
const resolveAllowedLocationIdsMock = vi.fn();
const itemFindUniqueMock = vi.fn();
const reservationAggregateMock = vi.fn();
const reservationCreateMock = vi.fn();

vi.mock("@/lib/api", () => ({
  requireWriteAccess: requireWriteAccessMock
}));

vi.mock("@/lib/permissions", () => ({
  resolveAllowedLocationIds: resolveAllowedLocationIdsMock
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findUnique: itemFindUniqueMock
    },
    reservation: {
      aggregate: reservationAggregateMock,
      create: reservationCreateMock
    }
  }
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe("Reservation availability guard", () => {
  it("rejects reservations that exceed available quantity", async () => {
    requireWriteAccessMock.mockResolvedValue({
      user: { id: "user-1", role: "READ_WRITE", email: "rw@example.com" }
    });
    resolveAllowedLocationIdsMock.mockResolvedValue(null);
    itemFindUniqueMock.mockResolvedValue({
      id: "item-1",
      stock: 5,
      storageLocationId: "loc-1"
    });
    reservationAggregateMock.mockResolvedValue({ _sum: { reservedQty: 4 } });

    const { POST } = await import("@/app/api/items/[id]/reservations/route");
    const response = await POST(
      new NextRequest(
        new Request("http://localhost/api/items/item-1/reservations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reservedQty: 2,
            reservedFor: "Werkbank"
          })
        })
      ),
      { params: { id: "item-1" } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Nicht genug verfuegbarer Bestand fuer diese Reservierung"
    });
    expect(reservationCreateMock).not.toHaveBeenCalled();
  });
});
