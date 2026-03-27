export const TRASH_RETENTION_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * DAY_MS;

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function getTrashCutoffDate(now = new Date()) {
  return new Date(now.getTime() - TRASH_RETENTION_MS);
}

export function getTrashExpiryDate(deletedAt: Date | string) {
  return new Date(toDate(deletedAt).getTime() + TRASH_RETENTION_MS);
}

export function isTrashExpired(deletedAt: Date | string, now = new Date()) {
  return getTrashExpiryDate(deletedAt).getTime() <= now.getTime();
}

export function getTrashDaysRemaining(deletedAt: Date | string, now = new Date()) {
  const diff = getTrashExpiryDate(deletedAt).getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}
