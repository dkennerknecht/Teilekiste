import type { Prisma, PrismaClient } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import {
  formatDrawerPosition,
  formatStoragePosition,
  getStorageBinCodeVariants,
  normalizeOptionalText,
  normalizeStorageShelfCode,
  normalizeStorageShelfMode
} from "@/lib/storage-bins";

type TransferDb =
  | Pick<PrismaClient, "item" | "storageLocation" | "storageShelf" | "storageBin" | "auditLog">
  | Pick<Prisma.TransactionClient, "item" | "storageLocation" | "storageShelf" | "storageBin" | "auditLog">;

type TransferItem = {
  id: string;
  labelCode?: string | null;
  name?: string | null;
  storageLocationId: string | null;
  storageShelfId?: string | null;
  storageArea?: string | null;
  storageBinId?: string | null;
  binSlot?: number | null;
  storageLocation?: { id: string; name: string; code?: string | null } | null;
  storageShelf?: { id: string; name: string; code?: string | null } | null;
  storageBin?: { id: string; code?: string | null } | null;
};

type TransferTarget = {
  storageLocationId: string;
  storageShelfId: string;
  storageBinId?: string | null;
  binSlot?: number | null;
};

type TransferLocationMeta = {
  id: string;
  name: string;
  code?: string | null;
};

type TransferShelfMeta = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  mode: string;
  storageLocationId: string;
};

type TransferBinMeta = {
  id: string;
  code: string;
  slotCount: number;
  storageLocationId: string;
  storageShelfId: string;
  isActive?: boolean;
};

function describeStoragePlace(input: {
  storageLocation?: TransferLocationMeta | null;
  storageShelf?: TransferShelfMeta | null;
  storageBin?: TransferBinMeta | null;
  binSlot?: number | null;
}) {
  return {
    storageLocationId: input.storageLocation?.id || null,
    storageLocationName: input.storageLocation?.name || null,
    storageShelfId: input.storageShelf?.id || null,
    storageShelfName: input.storageShelf?.name || null,
    storageShelfCode: input.storageShelf?.code || null,
    storageBinId: input.storageBin?.id || null,
    storageBinCode: input.storageBin?.code || null,
    binSlot: input.binSlot ?? null,
    displayPosition: formatStoragePosition({
      storageLocation: input.storageLocation,
      storageShelf: input.storageShelf,
      storageBin: input.storageBin,
      binSlot: input.binSlot
    })
  };
}

async function resolveLocationMeta(
  db: TransferDb,
  sourceLocationId: string | null,
  targetLocationId: string,
  sourceLocation?: TransferLocationMeta | null,
  targetLocation?: TransferLocationMeta | null
) {
  const missingIds = [sourceLocation ? null : sourceLocationId, targetLocation ? null : targetLocationId].filter(Boolean) as string[];
  if (!missingIds.length) {
    return {
      sourceLocation: sourceLocation!,
      targetLocation: targetLocation!
    };
  }

  const rows = await db.storageLocation.findMany({
    where: { id: { in: missingIds } },
    select: { id: true, name: true, code: true }
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    sourceLocation:
      sourceLocation ||
      (sourceLocationId
        ? byId.get(sourceLocationId) || { id: sourceLocationId, name: sourceLocationId, code: null }
        : { id: "unplaced", name: "Unplaced", code: null }),
    targetLocation: targetLocation || byId.get(targetLocationId) || { id: targetLocationId, name: targetLocationId, code: null }
  };
}

async function resolveShelfMeta(
  db: TransferDb,
  sourceShelfId: string | null | undefined,
  targetShelfId: string,
  sourceShelf?: TransferShelfMeta | null,
  targetShelf?: TransferShelfMeta | null
) {
  const missingIds = [sourceShelf ? null : sourceShelfId, targetShelf ? null : targetShelfId].filter(Boolean) as string[];
  if (!missingIds.length) {
    return {
      sourceShelf: sourceShelf!,
      targetShelf: targetShelf!
    };
  }

  const rows = await db.storageShelf.findMany({
    where: { id: { in: missingIds } },
    select: { id: true, name: true, code: true, description: true, mode: true, storageLocationId: true }
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    sourceShelf: sourceShelfId ? sourceShelf || byId.get(sourceShelfId) || null : null,
    targetShelf: targetShelf || byId.get(targetShelfId) || null
  };
}

async function resolveBinMeta(
  db: TransferDb,
  sourceBinId: string | null | undefined,
  targetBinId: string | null | undefined,
  sourceBin?: TransferBinMeta | null,
  targetBin?: TransferBinMeta | null
) {
  const missingIds = [sourceBin ? null : sourceBinId, targetBin ? null : targetBinId].filter(Boolean) as string[];
  if (!missingIds.length) {
    return {
      sourceBin: sourceBin || null,
      targetBin: targetBin || null
    };
  }

  const rows = await db.storageBin.findMany({
    where: { id: { in: missingIds } },
    select: {
      id: true,
      code: true,
      slotCount: true,
      storageLocationId: true,
      storageShelfId: true,
      isActive: true
    }
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return {
    sourceBin: sourceBinId ? sourceBin || byId.get(sourceBinId) || null : null,
    targetBin: targetBinId ? targetBin || byId.get(targetBinId) || null : null
  };
}

export async function validateTransferTarget(
  db: TransferDb,
  input: {
    storageLocationId: string;
    storageShelfId?: string | null;
    storageArea?: string | null;
    storageBinId?: string | null;
    bin?: string | null;
    binSlot?: number | null;
    allowedLocationIds?: string[] | null;
    existingItemId?: string | null;
  }
) {
  if (input.allowedLocationIds && !input.allowedLocationIds.includes(input.storageLocationId)) {
    throw new Error("TRANSFER_TARGET_FORBIDDEN");
  }

  const [location, shelf] = await Promise.all([
    db.storageLocation.findUnique({
      where: { id: input.storageLocationId },
      select: { id: true, name: true, code: true }
    }),
    input.storageShelfId
      ? db.storageShelf.findUnique({
          where: { id: input.storageShelfId },
          select: { id: true, name: true, code: true, description: true, mode: true, storageLocationId: true }
        })
      : db.storageShelf.findFirst({
          where: {
            storageLocationId: input.storageLocationId,
            OR: [
              { name: normalizeOptionalText(input.storageArea) || undefined },
              { code: normalizeStorageShelfCode(input.storageArea) || undefined }
            ]
          },
          select: { id: true, name: true, code: true, description: true, mode: true, storageLocationId: true }
        })
  ]);
  if (!location) {
    throw new Error("TRANSFER_TARGET_LOCATION_NOT_FOUND");
  }
  if (!shelf || shelf.storageLocationId !== input.storageLocationId) {
    throw new Error("TRANSFER_TARGET_SHELF_INVALID");
  }

  const normalizedMode = normalizeStorageShelfMode(shelf.mode);
  if (normalizedMode === "OPEN_AREA") {
    if (input.storageBinId || input.binSlot) {
      throw new Error("TRANSFER_TARGET_SHELF_OPEN_AREA_ONLY");
    }
    return {
      location,
      storageShelf: shelf,
      storageBin: null,
      binSlot: null
    };
  }

  const resolvedStorageBinId = input.storageBinId || null;
  const resolvedBinCode = normalizeOptionalText(input.bin);
  if (!resolvedStorageBinId && !resolvedBinCode) {
    throw new Error("TRANSFER_TARGET_BIN_REQUIRED");
  }

  const storageBin = resolvedStorageBinId
    ? await db.storageBin.findUnique({
        where: { id: resolvedStorageBinId },
        select: {
          id: true,
          code: true,
          slotCount: true,
          storageLocationId: true,
          storageShelfId: true,
          isActive: true
        }
      })
    : await db.storageBin.findFirst({
        where: {
          storageShelfId: shelf.id,
          code: { in: getStorageBinCodeVariants(resolvedBinCode) },
          isActive: true
        },
        select: {
          id: true,
          code: true,
          slotCount: true,
          storageLocationId: true,
          storageShelfId: true,
          isActive: true
        }
      });
  if (!storageBin || storageBin.isActive === false) {
    throw new Error("TRANSFER_TARGET_BIN_INVALID");
  }
  if (storageBin.storageLocationId !== input.storageLocationId || storageBin.storageShelfId !== input.storageShelfId) {
    throw new Error("TRANSFER_TARGET_BIN_INVALID");
  }

  const binSlot = input.binSlot ?? null;
  if (!binSlot) {
    throw new Error("TRANSFER_TARGET_BIN_SLOT_REQUIRED");
  }
  if (binSlot < 1 || binSlot > storageBin.slotCount) {
    throw new Error("TRANSFER_TARGET_BIN_SLOT_INVALID");
  }

  const conflictingItem = await db.item.findFirst({
    where: {
      id: input.existingItemId ? { not: input.existingItemId } : undefined,
      deletedAt: null,
      isArchived: false,
      mergedIntoItemId: null,
      storageBinId: storageBin.id,
      binSlot
    },
    select: { id: true }
  });
  if (conflictingItem) {
    throw new Error("TRANSFER_TARGET_BIN_SLOT_OCCUPIED");
  }

  return {
    location,
    storageShelf: shelf,
    storageBin,
    binSlot
  };
}

export async function applyItemTransfer(
  db: TransferDb,
  input: {
    item: TransferItem;
    target: TransferTarget;
    userId: string;
    note?: string | null;
    sourceLocation?: TransferLocationMeta | null;
    sourceShelf?: TransferShelfMeta | null;
    sourceBin?: TransferBinMeta | null;
    targetLocation?: TransferLocationMeta | null;
    targetShelf?: TransferShelfMeta | null;
    targetBin?: TransferBinMeta | null;
  }
) {
  const normalizedTarget = {
    storageLocationId: input.target.storageLocationId,
    storageShelfId: input.target.storageShelfId,
    storageBinId: input.target.storageBinId || null,
    binSlot: input.target.binSlot ?? null
  };
  const currentSource = {
    storageLocationId: input.item.storageLocationId,
    storageShelfId: input.item.storageShelfId || null,
    storageBinId: input.item.storageBinId || null,
    binSlot: input.item.binSlot ?? null
  };

  const changed =
    currentSource.storageLocationId !== normalizedTarget.storageLocationId ||
    currentSource.storageShelfId !== normalizedTarget.storageShelfId ||
    currentSource.storageBinId !== normalizedTarget.storageBinId ||
    currentSource.binSlot !== normalizedTarget.binSlot;

  if (!changed) {
    return {
      changed: false as const,
      item: input.item
    };
  }

  const { sourceLocation, targetLocation } = await resolveLocationMeta(
    db,
    input.item.storageLocationId,
    normalizedTarget.storageLocationId,
    input.sourceLocation || input.item.storageLocation || null,
    input.targetLocation || null
  );
  const { sourceShelf, targetShelf } = await resolveShelfMeta(
    db,
    input.item.storageShelfId || null,
    normalizedTarget.storageShelfId,
    input.sourceShelf || (input.item.storageShelf as TransferShelfMeta | null) || null,
    input.targetShelf || null
  );
  const { sourceBin, targetBin } = await resolveBinMeta(
    db,
    input.item.storageBinId || null,
    normalizedTarget.storageBinId,
    input.sourceBin || (input.item.storageBin as TransferBinMeta | null) || null,
    input.targetBin || null
  );

  const updatedItem = await db.item.update({
    where: { id: input.item.id },
    data: {
      storageLocationId: normalizedTarget.storageLocationId,
      storageShelfId: normalizedTarget.storageShelfId,
      storageArea: targetShelf?.name || null,
      storageBinId: normalizedTarget.storageBinId,
      binSlot: normalizedTarget.binSlot,
      placementStatus: "PLACED"
    }
  });

  const note = normalizeOptionalText(input.note);

  await auditLog(
    {
      userId: input.userId,
      action: "ITEM_TRANSFER",
      entity: "Item",
      entityId: input.item.id,
      before: describeStoragePlace({
        storageLocation: sourceLocation,
        storageShelf: sourceShelf,
        storageBin: sourceBin,
        binSlot: input.item.binSlot || null
      }),
      after: {
        ...describeStoragePlace({
          storageLocation: targetLocation,
          storageShelf: targetShelf,
          storageBin: targetBin,
          binSlot: normalizedTarget.binSlot
        }),
        note
      }
    },
    db
  );

  return {
    changed: true as const,
    item: updatedItem
  };
}

export function buildTransferSourceGroups(
  items: Array<TransferItem & { storageLocation?: TransferLocationMeta | null; storageShelf?: TransferShelfMeta | null; storageBin?: TransferBinMeta | null }>
) {
  const groups = new Map<
    string,
    {
      storageLocationId: string;
      storageLocationName: string;
      storageShelfId: string | null;
      storageShelfCode: string | null;
      storageShelfName: string | null;
      storageBinId: string | null;
      storageBinCode: string | null;
      binSlot: number | null;
      storageArea: string | null;
      bin: string | null;
      displayPosition: string | null;
      count: number;
    }
  >();

  for (const item of items) {
    const shelfCode = normalizeOptionalText(item.storageShelf?.code);
    const shelfName = normalizeOptionalText(item.storageShelf?.name || item.storageArea);
    const drawerCode = normalizeOptionalText(item.storageBin?.code);
    const key = [
      item.storageLocationId || "unplaced",
      item.storageShelfId || "",
      item.storageBinId || "",
      String(item.binSlot || "")
    ].join("::");
    const current = groups.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    groups.set(key, {
      storageLocationId: item.storageLocationId || "unplaced",
      storageLocationName: item.storageLocation?.name || item.storageLocationId || "Unplaced",
      storageShelfId: item.storageShelfId || null,
      storageShelfCode: shelfCode,
      storageShelfName: shelfName,
      storageBinId: item.storageBinId || null,
      storageBinCode: drawerCode,
      binSlot: item.binSlot || null,
      storageArea: shelfName,
      bin: formatDrawerPosition(drawerCode, item.binSlot || null),
      displayPosition: formatStoragePosition({
        storageLocation: item.storageLocation,
        storageShelf: item.storageShelf || (shelfCode || shelfName ? { code: shelfCode, name: shelfName } : null),
        storageBin: item.storageBin || (drawerCode ? { code: drawerCode } : null),
        binSlot: item.binSlot || null,
        storageArea: item.storageArea || null
      }),
      count: 1
    });
  }

  return Array.from(groups.values()).sort(
    (left, right) =>
      left.storageLocationName.localeCompare(right.storageLocationName, "de") ||
      String(left.storageShelfCode || left.storageShelfName || "").localeCompare(String(right.storageShelfCode || right.storageShelfName || ""), "de") ||
      String(left.storageBinCode || "").localeCompare(String(right.storageBinCode || ""), "de") ||
      (left.binSlot || 0) - (right.binSlot || 0)
  );
}
