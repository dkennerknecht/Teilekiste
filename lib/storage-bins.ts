import type { Prisma, PrismaClient } from "@prisma/client";
import { canWrite, type AppRole } from "@/lib/permissions";
import {
  formatDrawerPosition as formatDrawerPositionLabel,
  formatStorageBinLabel,
  formatStorageShelfLabel,
  getStorageBinCodeVariants,
  isManagedStorageBinCode,
  isManagedStorageShelfCode,
  normalizeStorageBinCode,
  normalizeStorageShelfCode,
  parseManagedDrawerLabel,
  parseManagedStorageShelfLabel
} from "@/lib/storage-labels";

export {
  formatStorageBinLabel,
  formatStorageShelfLabel,
  getStorageBinCodeVariants,
  isManagedStorageBinCode,
  isManagedStorageShelfCode,
  normalizeStorageBinCode,
  normalizeStorageShelfCode
};

export const placementStatuses = ["INCOMING", "UNPLACED", "PLACED"] as const;
export type PlacementStatus = (typeof placementStatuses)[number];
export const storageShelfModes = ["OPEN_AREA", "DRAWER_HOST"] as const;
export type StorageShelfMode = (typeof storageShelfModes)[number];

type PlacementDb =
  | Pick<PrismaClient, "storageLocation" | "storageShelf" | "storageBin" | "item">
  | Pick<Prisma.TransactionClient, "storageLocation" | "storageShelf" | "storageBin" | "item">;

type StorageBinCodeLookupDb =
  | Pick<PrismaClient, "storageBin">
  | Pick<Prisma.TransactionClient, "storageBin">;

type StorageShelfCodeLookupDb =
  | Pick<PrismaClient, "storageShelf">
  | Pick<Prisma.TransactionClient, "storageShelf">;

type StorageShelfRecord = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  mode: string;
  storageLocationId: string;
};

type StorageBinRecord = {
  id: string;
  code: string;
  storageLocationId: string;
  storageShelfId: string;
  storageArea: string | null;
  slotCount: number;
  isActive?: boolean;
  storageShelf?: StorageShelfRecord | null;
};

type PlacementInput = {
  placementStatus?: string | null;
  storageLocationId?: string | null;
  storageShelfId?: string | null;
  storageArea?: string | null;
  storageBinId?: string | null;
  binSlot?: number | null;
  allowedLocationIds?: string[] | null;
  existingItemId?: string | null;
};

function isPlacementStatus(value: string | null | undefined): value is PlacementStatus {
  return placementStatuses.includes((value || "").toUpperCase() as PlacementStatus);
}

function isStorageShelfMode(value: string | null | undefined): value is StorageShelfMode {
  return storageShelfModes.includes((value || "").toUpperCase() as StorageShelfMode);
}

function isUuidLike(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

export function normalizePlacementStatus(value: string | null | undefined, fallback: PlacementStatus = "PLACED"): PlacementStatus {
  if (!value) return fallback;
  const normalized = value.trim().toUpperCase();
  return isPlacementStatus(normalized) ? normalized : fallback;
}

export function normalizeStorageShelfMode(value: string | null | undefined, fallback: StorageShelfMode = "OPEN_AREA"): StorageShelfMode {
  if (!value) return fallback;
  const normalized = value.trim().toUpperCase();
  return isStorageShelfMode(normalized) ? normalized : fallback;
}

export function isPlacedStatus(value: string | null | undefined) {
  return normalizePlacementStatus(value) === "PLACED";
}

export function formatDrawerPosition(
  code: string | null | undefined,
  slot: number | null | undefined,
  slotCount?: number | null,
  shelfCode?: string | null
) {
  return formatDrawerPositionLabel(code, slot, slotCount, shelfCode);
}

function normalizeDrawerSlotSelection(slotCount: number, binSlot: number | null | undefined) {
  if (slotCount <= 1) {
    if (binSlot && binSlot !== 1) {
      throw new Error("PLACEMENT_BIN_SLOT_INVALID");
    }
    return null;
  }
  return binSlot ?? null;
}

export function formatStoragePosition(input: {
  storageLocation?: { name?: string | null } | null;
  storageShelf?: { code?: string | null; name?: string | null } | null;
  storageBin?: { code?: string | null; slotCount?: number | null } | null;
  binSlot?: number | null;
  storageArea?: string | null;
}) {
  const shelfLabel =
    formatStorageShelfLabel(input.storageShelf?.code, input.storageShelf?.name) || normalizeOptionalText(input.storageArea);
  const drawerLabel = formatDrawerPosition(
    input.storageBin?.code || null,
    input.binSlot || null,
    input.storageBin?.slotCount ?? null,
    input.storageShelf?.code || null
  );
  const parts = [
    normalizeOptionalText(input.storageLocation?.name),
    drawerLabel || shelfLabel
  ].filter(Boolean);

  return parts.join(" / ") || null;
}

export function formatItemPosition(input: {
  storageLocation?: { name?: string | null } | null;
  storageShelf?: { code?: string | null; name?: string | null } | null;
  storageBin?: { code?: string | null; slotCount?: number | null } | null;
  storageArea?: string | null;
  binSlot?: number | null;
}) {
  return formatStoragePosition(input);
}

export function buildPlacementAccessWhere(
  allowedLocationIds: string[] | null,
  role: AppRole
): Prisma.ItemWhereInput | undefined {
  if (!allowedLocationIds) return undefined;
  if (!allowedLocationIds.length) {
    return canWrite(role) ? { storageLocationId: null } : { id: "__none__" };
  }
  if (canWrite(role)) {
    return {
      OR: [
        { storageLocationId: { in: allowedLocationIds } },
        { storageLocationId: null }
      ]
    };
  }
  return {
    storageLocationId: { in: allowedLocationIds }
  };
}

async function ensureAllowedLocationId(storageLocationId: string, allowedLocationIds?: string[] | null) {
  if (allowedLocationIds && !allowedLocationIds.includes(storageLocationId)) {
    throw new Error("PLACEMENT_LOCATION_FORBIDDEN");
  }
}

async function findStorageShelfByIdOrArea(
  db: PlacementDb,
  input: {
    storageLocationId: string | null;
    storageShelfId?: string | null;
    storageArea?: string | null;
  }
) {
  const normalizedStorageArea = normalizeOptionalText(input.storageArea);

  if (input.storageShelfId) {
    return db.storageShelf.findUnique({
      where: { id: input.storageShelfId },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        mode: true,
        storageLocationId: true
      }
    }) as Promise<StorageShelfRecord | null>;
  }

  if (!input.storageLocationId || !normalizedStorageArea) {
    return null;
  }

  return (await db.storageShelf.findFirst({
    where: {
      storageLocationId: input.storageLocationId,
      OR: [{ id: normalizedStorageArea }, { name: normalizedStorageArea }, { code: normalizeStorageShelfCode(normalizedStorageArea) }]
    },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      mode: true,
      storageLocationId: true
    }
  })) as StorageShelfRecord | null;
}

async function resolveOpenShelfPlacement(
  db: PlacementDb,
  input: PlacementInput
) {
  const storageLocationId = input.storageLocationId || null;
  if (!storageLocationId) {
    throw new Error("PLACEMENT_LOCATION_REQUIRED");
  }
  await ensureAllowedLocationId(storageLocationId, input.allowedLocationIds);

  const location = await db.storageLocation.findUnique({
    where: { id: storageLocationId },
    select: { id: true }
  });
  if (!location) {
    throw new Error("PLACEMENT_LOCATION_NOT_FOUND");
  }

  const storageShelf = await findStorageShelfByIdOrArea(db, {
    storageLocationId,
    storageShelfId: input.storageShelfId || null,
    storageArea: input.storageArea || null
  });
  if (!storageShelf) {
    throw new Error("PLACEMENT_SHELF_REQUIRED");
  }
  if (storageShelf.storageLocationId !== storageLocationId) {
    throw new Error("PLACEMENT_SHELF_SCOPE_MISMATCH");
  }
  if (normalizeStorageShelfMode(storageShelf.mode) !== "OPEN_AREA") {
    throw new Error("PLACEMENT_SHELF_REQUIRES_DRAWER");
  }

  return {
    placementStatus: "PLACED" as const,
    storageLocationId,
    storageShelfId: storageShelf.id,
    storageArea: storageShelf.name,
    storageBinId: null,
    binSlot: null,
    storageShelf,
    storageBin: null
  };
}

async function resolveManagedDrawerPlacement(
  db: PlacementDb,
  input: PlacementInput
) {
  const storageBinId = input.storageBinId || null;
  if (!storageBinId) {
    throw new Error("PLACEMENT_BIN_REQUIRED");
  }
  const storageBin = (await db.storageBin.findUnique({
    where: { id: storageBinId },
    select: {
      id: true,
      code: true,
      storageLocationId: true,
      storageShelfId: true,
      storageArea: true,
      slotCount: true,
      isActive: true,
      storageShelf: {
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          mode: true,
          storageLocationId: true
        }
      }
    }
  })) as StorageBinRecord | null;
  if (!storageBin || storageBin.isActive === false) {
    throw new Error("PLACEMENT_BIN_NOT_FOUND");
  }

  await ensureAllowedLocationId(storageBin.storageLocationId, input.allowedLocationIds);

  if (input.storageLocationId && input.storageLocationId !== storageBin.storageLocationId) {
    throw new Error("PLACEMENT_BIN_SCOPE_MISMATCH");
  }
  if (input.storageShelfId && input.storageShelfId !== storageBin.storageShelfId) {
    throw new Error("PLACEMENT_BIN_SHELF_MISMATCH");
  }

  const storageShelf = storageBin.storageShelf || null;
  if (!storageShelf) {
    throw new Error("PLACEMENT_SHELF_INVALID");
  }
  if (normalizeStorageShelfMode(storageShelf.mode) !== "DRAWER_HOST") {
    throw new Error("PLACEMENT_SHELF_OPEN_AREA_ONLY");
  }

  const binSlot = normalizeDrawerSlotSelection(storageBin.slotCount, input.binSlot ?? null);
  if (storageBin.slotCount > 1 && !binSlot) {
    throw new Error("PLACEMENT_BIN_SLOT_REQUIRED");
  }
  if (binSlot !== null && (binSlot < 1 || binSlot > storageBin.slotCount)) {
    throw new Error("PLACEMENT_BIN_SLOT_INVALID");
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
    throw new Error("PLACEMENT_BIN_SLOT_OCCUPIED");
  }

  return {
    placementStatus: "PLACED" as const,
    storageLocationId: storageBin.storageLocationId,
    storageShelfId: storageShelf.id,
    storageArea: storageShelf.name,
    storageBinId: storageBin.id,
    binSlot,
    storageShelf,
    storageBin
  };
}

export async function resolveItemPlacement(
  db: PlacementDb,
  input: PlacementInput
) {
  const placementStatus = normalizePlacementStatus(input.placementStatus, "PLACED");

  if (placementStatus !== "PLACED") {
    return {
      placementStatus,
      storageLocationId: null,
      storageShelfId: null,
      storageArea: null,
      storageBinId: null,
      binSlot: null,
      storageShelf: null,
      storageBin: null
    };
  }

  if (input.storageBinId) {
    return resolveManagedDrawerPlacement(db, input);
  }

  return resolveOpenShelfPlacement(db, input);
}

export async function findStorageBinByCode(
  db: StorageBinCodeLookupDb,
  codeOrId: string | null | undefined
) {
  const normalized = normalizeOptionalText(codeOrId);
  if (!normalized) {
    return null;
  }

  if (isUuidLike(normalized)) {
    return db.storageBin.findUnique({ where: { id: normalized } });
  }

  const managedDrawerLabel = parseManagedDrawerLabel(normalized);
  if (managedDrawerLabel) {
    const matches = await db.storageBin.findMany({
      where: {
        code: managedDrawerLabel.binCode,
        storageShelf: {
          code: managedDrawerLabel.shelfCode
        }
      },
      take: 2
    });
    return matches.length === 1 ? matches[0] : null;
  }

  const variants = getStorageBinCodeVariants(normalized);
  const matches = await db.storageBin.findMany({
    where: { code: { in: variants } },
    take: 2
  });

  return matches.length === 1 ? matches[0] : null;
}

export async function findStorageShelfByCode(
  db: StorageShelfCodeLookupDb,
  codeOrId: string | null | undefined
) {
  const normalized = normalizeOptionalText(codeOrId);
  if (!normalized) {
    return null;
  }

  if (isUuidLike(normalized)) {
    return db.storageShelf.findUnique({ where: { id: normalized } });
  }

  const managedShelfCode = parseManagedStorageShelfLabel(normalized);
  if (managedShelfCode) {
    const matches = await db.storageShelf.findMany({
      where: { code: managedShelfCode },
      take: 2
    });
    return matches.length === 1 ? matches[0] : null;
  }

  const matches = await db.storageShelf.findMany({
    where: { code: normalizeStorageShelfCode(normalized) },
    take: 2
  });

  return matches.length === 1 ? matches[0] : null;
}

export async function findStorageBinCodeConflict(
  db: StorageBinCodeLookupDb,
  code: string | null | undefined,
  storageShelfId?: string,
  excludeId?: string
) {
  const variants = getStorageBinCodeVariants(code);
  if (!variants.length) {
    return null;
  }

  return db.storageBin.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      storageShelfId: storageShelfId || undefined,
      code: { in: variants }
    },
    select: { id: true, code: true, storageShelfId: true }
  });
}

export async function previewStorageBinSlotCountChange(
  db: Pick<PrismaClient, "storageBin" | "item"> | Pick<Prisma.TransactionClient, "storageBin" | "item">,
  input: {
    id: string;
    slotCount: number;
  }
) {
  const storageBin = await db.storageBin.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      code: true,
      storageLocationId: true,
      storageShelfId: true,
      storageArea: true,
      slotCount: true
    }
  });
  if (!storageBin) {
    throw new Error("STORAGE_BIN_NOT_FOUND");
  }

  const displacedItems = await db.item.findMany({
    where: {
      storageBinId: input.id,
      binSlot: { gt: input.slotCount },
      deletedAt: null,
      isArchived: false,
      mergedIntoItemId: null
    },
    select: {
      id: true,
      labelCode: true,
      name: true,
      binSlot: true,
      stock: true,
      incomingQty: true,
      placementStatus: true
    },
    orderBy: [{ binSlot: "asc" }, { labelCode: "asc" }]
  });

  return {
    storageBin,
    slotCount: input.slotCount,
    displacedItems
  };
}

export async function applyStorageBinSlotCountChange(
  db: Pick<Prisma.TransactionClient, "storageBin" | "item">,
  input: {
    id: string;
    slotCount: number;
  }
) {
  const preview = await previewStorageBinSlotCountChange(db, input);
  await db.storageBin.update({
    where: { id: input.id },
    data: { slotCount: input.slotCount }
  });

  for (const item of preview.displacedItems) {
    const nextPlacementStatus: PlacementStatus =
      item.stock > 0 ? "UNPLACED" : item.incomingQty > 0 ? "INCOMING" : "UNPLACED";
    await db.item.update({
      where: { id: item.id },
      data: {
        storageLocationId: null,
        storageShelfId: null,
        storageArea: null,
        storageBinId: null,
        binSlot: null,
        placementStatus: nextPlacementStatus
      }
    });
  }

  return preview;
}

function getEffectiveSlot(binSlot: number | null | undefined, slotCount?: number | null) {
  if ((slotCount ?? null) !== null && Number(slotCount) <= 1) {
    return 1;
  }
  return binSlot ?? null;
}

function normalizeStoredSlotForTarget(slot: number | null, targetSlotCount?: number | null) {
  if ((targetSlotCount ?? null) !== null && Number(targetSlotCount) <= 1) {
    return null;
  }
  return slot;
}

function assertBinContentFitsTarget(
  items: Array<{ binSlot: number | null }>,
  targetBin: { slotCount?: number | null }
) {
  const targetSlotCount = targetBin.slotCount ?? null;
  const targetEffectiveMax = targetSlotCount !== null && targetSlotCount <= 1 ? 1 : targetSlotCount;
  for (const item of items) {
    const effectiveSlot = getEffectiveSlot(item.binSlot, targetSlotCount);
    if (effectiveSlot !== null && targetEffectiveMax !== null && effectiveSlot > targetEffectiveMax) {
      throw new Error("STORAGE_BIN_TARGET_SLOT_CAPACITY_MISMATCH");
    }
  }
}

async function loadStorageBinsForPlacementChange(
  db: Pick<Prisma.TransactionClient, "storageBin" | "item">,
  input: {
    leftBinId: string;
    rightBinId: string;
  }
) {
  const bins = await db.storageBin.findMany({
    where: { id: { in: [input.leftBinId, input.rightBinId] } },
    select: {
      id: true,
      code: true,
      storageLocationId: true,
      storageShelfId: true,
      storageArea: true,
      slotCount: true
    }
  });
  const leftBin = bins.find((entry) => entry.id === input.leftBinId);
  const rightBin = bins.find((entry) => entry.id === input.rightBinId);

  if (!leftBin || !rightBin) {
    throw new Error("STORAGE_BIN_NOT_FOUND");
  }
  if (leftBin.storageLocationId !== rightBin.storageLocationId) {
    throw new Error("STORAGE_BIN_SWAP_SCOPE_MISMATCH");
  }
  return { leftBin, rightBin };
}

export async function swapStorageBinContents(
  db: Pick<Prisma.TransactionClient, "storageBin" | "item">,
  input: {
    leftBinId: string;
    rightBinId: string;
  }
) {
  const { leftBin, rightBin } = await loadStorageBinsForPlacementChange(db, input);

  const [leftItems, rightItems] = await Promise.all([
    db.item.findMany({
      where: {
        storageBinId: leftBin.id,
        deletedAt: null,
        isArchived: false,
        mergedIntoItemId: null
      },
      select: { id: true, binSlot: true },
      orderBy: [{ binSlot: "asc" }, { labelCode: "asc" }]
    }),
    db.item.findMany({
      where: {
        storageBinId: rightBin.id,
        deletedAt: null,
        isArchived: false,
        mergedIntoItemId: null
      },
      select: { id: true, binSlot: true },
      orderBy: [{ binSlot: "asc" }, { labelCode: "asc" }]
    })
  ]);

  assertBinContentFitsTarget(leftItems, rightBin);
  assertBinContentFitsTarget(rightItems, leftBin);

  const resetIds = [...leftItems.map((item) => item.id), ...rightItems.map((item) => item.id)];
  if (resetIds.length) {
    await db.item.updateMany({
      where: { id: { in: resetIds } },
      data: {
        storageLocationId: null,
        storageShelfId: null,
        storageArea: null,
        storageBinId: null,
        binSlot: null,
        placementStatus: "UNPLACED"
      }
    });
  }

  for (const item of leftItems) {
    await db.item.update({
      where: { id: item.id },
      data: {
        storageLocationId: rightBin.storageLocationId,
        storageShelfId: rightBin.storageShelfId,
        storageArea: rightBin.storageArea || null,
        storageBinId: rightBin.id,
        binSlot: normalizeStoredSlotForTarget(getEffectiveSlot(item.binSlot, leftBin.slotCount), rightBin.slotCount),
        placementStatus: "PLACED"
      }
    });
  }

  for (const item of rightItems) {
    await db.item.update({
      where: { id: item.id },
      data: {
        storageLocationId: leftBin.storageLocationId,
        storageShelfId: leftBin.storageShelfId,
        storageArea: leftBin.storageArea || null,
        storageBinId: leftBin.id,
        binSlot: normalizeStoredSlotForTarget(getEffectiveSlot(item.binSlot, rightBin.slotCount), leftBin.slotCount),
        placementStatus: "PLACED"
      }
    });
  }

  return {
    leftBin,
    rightBin,
    leftCount: leftItems.length,
    rightCount: rightItems.length
  };
}

export async function moveStorageBinContents(
  db: Pick<Prisma.TransactionClient, "storageBin" | "item">,
  input: {
    sourceBinId: string;
    targetBinId: string;
  }
) {
  const { leftBin: sourceBin, rightBin: targetBin } = await loadStorageBinsForPlacementChange(db, {
    leftBinId: input.sourceBinId,
    rightBinId: input.targetBinId
  });

  const [sourceItems, targetItems] = await Promise.all([
    db.item.findMany({
      where: {
        storageBinId: sourceBin.id,
        deletedAt: null,
        isArchived: false,
        mergedIntoItemId: null
      },
      select: { id: true, binSlot: true },
      orderBy: [{ binSlot: "asc" }, { labelCode: "asc" }]
    }),
    db.item.findMany({
      where: {
        storageBinId: targetBin.id,
        deletedAt: null,
        isArchived: false,
        mergedIntoItemId: null
      },
      select: { id: true },
      take: 1
    })
  ]);

  if (targetItems.length > 0) {
    throw new Error("STORAGE_BIN_MOVE_TARGET_NOT_EMPTY");
  }

  assertBinContentFitsTarget(sourceItems, targetBin);

  for (const item of sourceItems) {
    await db.item.update({
      where: { id: item.id },
      data: {
        storageLocationId: targetBin.storageLocationId,
        storageShelfId: targetBin.storageShelfId,
        storageArea: targetBin.storageArea || null,
        storageBinId: targetBin.id,
        binSlot: normalizeStoredSlotForTarget(getEffectiveSlot(item.binSlot, sourceBin.slotCount), targetBin.slotCount),
        placementStatus: "PLACED"
      }
    });
  }

  return {
    sourceBin,
    targetBin,
    movedCount: sourceItems.length
  };
}

export function mapPlacementError(error: unknown) {
  switch ((error as Error).message) {
    case "PLACEMENT_LOCATION_FORBIDDEN":
      return { status: 403, body: { error: "Storage location not allowed" } };
    case "PLACEMENT_LOCATION_REQUIRED":
      return { status: 400, body: { error: "Lagerort ist fuer eingelagerten Bestand erforderlich" } };
    case "PLACEMENT_LOCATION_NOT_FOUND":
      return { status: 400, body: { error: "Lagerort nicht gefunden" } };
    case "PLACEMENT_SHELF_REQUIRED":
      return { status: 400, body: { error: "Regal/Bereich ist fuer eingelagerten Bestand erforderlich" } };
    case "PLACEMENT_SHELF_INVALID":
      return { status: 400, body: { error: "Regal/Bereich ist fuer den Lagerort ungueltig" } };
    case "PLACEMENT_SHELF_SCOPE_MISMATCH":
      return { status: 400, body: { error: "Regal/Bereich gehoert nicht zum gewaehlten Lagerort" } };
    case "PLACEMENT_SHELF_REQUIRES_DRAWER":
      return { status: 400, body: { error: "Dieses Regal erfordert einen Drawer" } };
    case "PLACEMENT_SHELF_OPEN_AREA_ONLY":
      return { status: 400, body: { error: "Dieses Regal erlaubt keine Drawer-Belegung" } };
    case "PLACEMENT_BIN_REQUIRED":
      return { status: 400, body: { error: "Drawer ist erforderlich" } };
    case "PLACEMENT_BIN_NOT_FOUND":
      return { status: 400, body: { error: "Drawer nicht gefunden" } };
    case "PLACEMENT_BIN_SCOPE_MISMATCH":
    case "PLACEMENT_BIN_SHELF_MISMATCH":
      return { status: 400, body: { error: "Drawer passt nicht zum gewaehlten Lagerort oder Regal" } };
    case "PLACEMENT_BIN_SLOT_REQUIRED":
      return { status: 400, body: { error: "Unterfach ist erforderlich" } };
    case "PLACEMENT_BIN_SLOT_INVALID":
      return { status: 400, body: { error: "Unterfach liegt ausserhalb der Drawer-Kapazitaet" } };
    case "PLACEMENT_BIN_SLOT_OCCUPIED":
      return { status: 409, body: { error: "Dieses Unterfach ist bereits belegt" } };
    case "STORAGE_BIN_NOT_FOUND":
      return { status: 404, body: { error: "Drawer nicht gefunden" } };
    case "STORAGE_BIN_SWAP_SCOPE_MISMATCH":
      return { status: 400, body: { error: "Drawer-Move oder -Tausch ist nur innerhalb desselben Lagerorts moeglich" } };
    case "STORAGE_BIN_MOVE_TARGET_NOT_EMPTY":
      return { status: 409, body: { error: "Ziel-Drawer ist bereits belegt" } };
    case "STORAGE_BIN_TARGET_SLOT_CAPACITY_MISMATCH":
      return { status: 400, body: { error: "Die Zielposition hat nicht genug Unterfaecher fuer die aktuelle Belegung" } };
    default:
      return null;
  }
}
