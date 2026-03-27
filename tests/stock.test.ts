import { describe, expect, it } from "vitest";
import { canReserveQty, canSetStock, getAvailableQty, getRawAvailableQty, getReservedQty } from "@/lib/stock";

describe("stock helpers", () => {
  it("clamps available quantity at zero", () => {
    const reservations = [{ reservedQty: 3 }, { reservedQty: 4 }];

    expect(getReservedQty(reservations)).toBe(7);
    expect(getRawAvailableQty(5, reservations)).toBe(-2);
    expect(getAvailableQty(5, reservations)).toBe(0);
  });

  it("validates reservation and stock updates against reserved quantity", () => {
    expect(canReserveQty(10, 4, 6)).toBe(true);
    expect(canReserveQty(10, 4, 7)).toBe(false);
    expect(canSetStock(4, 4)).toBe(true);
    expect(canSetStock(3, 4)).toBe(false);
  });
});
