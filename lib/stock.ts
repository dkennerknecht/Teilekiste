type ReservationLike = { reservedQty: number };

function resolveReservedQty(input: number | ReservationLike[] | null | undefined) {
  if (typeof input === "number") return input;
  return (input || []).reduce((sum, reservation) => sum + reservation.reservedQty, 0);
}

export function getReservedQty(input: ReservationLike[] | null | undefined) {
  return resolveReservedQty(input);
}

export function getRawAvailableQty(stock: number, input: number | ReservationLike[] | null | undefined) {
  return stock - resolveReservedQty(input);
}

export function getAvailableQty(stock: number, input: number | ReservationLike[] | null | undefined) {
  return Math.max(0, getRawAvailableQty(stock, input));
}

export function canReserveQty(stock: number, input: number | ReservationLike[] | null | undefined, requestedQty: number) {
  return requestedQty <= getRawAvailableQty(stock, input);
}

export function canSetStock(stock: number, input: number | ReservationLike[] | null | undefined) {
  return stock >= resolveReservedQty(input);
}
