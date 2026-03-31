type ReservationLike = { reservedQty: number };
type PlacementStatusLike = string | null | undefined;

function resolveReservedQty(input: number | ReservationLike[] | null | undefined) {
  if (typeof input === "number") return input;
  return (input || []).reduce((sum, reservation) => sum + reservation.reservedQty, 0);
}

export function getReservedQty(input: ReservationLike[] | null | undefined) {
  return resolveReservedQty(input);
}

function countsAsAvailableStock(placementStatus?: PlacementStatusLike) {
  return !placementStatus || placementStatus === "PLACED";
}

export function getRawAvailableQty(
  stock: number,
  input: number | ReservationLike[] | null | undefined,
  placementStatus?: PlacementStatusLike
) {
  if (!countsAsAvailableStock(placementStatus)) return 0;
  return stock - resolveReservedQty(input);
}

export function getAvailableQty(
  stock: number,
  input: number | ReservationLike[] | null | undefined,
  placementStatus?: PlacementStatusLike
) {
  return Math.max(0, getRawAvailableQty(stock, input, placementStatus));
}

export function canReserveQty(
  stock: number,
  input: number | ReservationLike[] | null | undefined,
  requestedQty: number,
  placementStatus?: PlacementStatusLike
) {
  return requestedQty <= getRawAvailableQty(stock, input, placementStatus);
}

export function canSetStock(stock: number, input: number | ReservationLike[] | null | undefined) {
  return stock >= resolveReservedQty(input);
}
