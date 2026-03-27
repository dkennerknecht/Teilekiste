import { prisma } from "@/lib/prisma";
import { getTrashCutoffDate, isTrashExpired } from "@/lib/trash-policy";

let lastTrashPurgeAt = 0;
const TRASH_PURGE_INTERVAL_MS = 60 * 1000;

export async function purgeExpiredDeletedItems(force = false) {
  const now = Date.now();
  if (!force && now - lastTrashPurgeAt < TRASH_PURGE_INTERVAL_MS) {
    return 0;
  }

  lastTrashPurgeAt = now;
  const result = await prisma.item.deleteMany({
    where: {
      deletedAt: {
        lte: getTrashCutoffDate(new Date(now))
      }
    }
  });

  return result.count;
}

export function canRestoreDeletedItem(deletedAt: Date | string | null | undefined, now = new Date()) {
  if (!deletedAt) return false;
  return !isTrashExpired(deletedAt, now);
}
