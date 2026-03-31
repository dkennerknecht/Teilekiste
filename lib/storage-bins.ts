import type { Prisma, PrismaClient } from "@prisma/client";
import { canWrite, type AppRole } from "@/lib/permissions";

export const placementStatuses = ["INCOMING", "UNPLACED", "PLACED"] as const;
export type PlacementStatus = (typeof placementStatuses)[number];

type PlacementDb =
  | Pick<PrismaClient, "storageLocation" | "storageShelf" | "storageBin" | "item">
  | Pick<Prisma.TransactionClient, "storageLocation" | "storageShelf" | "storageBin" | "item">;

type StorageBinRecord = {
  id: string;
  code: string;
  storageLocationId: string;
  storageArea: string | null;
  slotCount: number;
  isActive?: boolean;
};

type PlacementInput = {
  placementStatus?: string | null;
  storageLocationId?: string | null;
  storageArea?: string | null;
  bin?: string | null;
  storageBinId?: string | null;
  binSlot?: number | null;
  allowedLocationIds?: string[] | null;
  existingItemId?: string | null;
};

function isPlacementStatus(value: string | null | undefined): value is PlacementStatus {
  return placementStatuses.includes((value || "").toUpperCase() as PlacementStatus);
}

export function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

export function normalizeStorageBinCode(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

export function normalizePlacementStatus(value: string | null | undefined, fallback: PlacementStatus = "PLACED"): PlacementStatus {
  if (!value) return fallback;
  const normalized = value.trim().toUpperCase();
  return isPlacementStatus(normalized) ? normalized : fallback;
}

export function isPlacedStatus(value: string | null | undefined) {
  return normalizePlacementStatus(value) === "PLACED";
}

export function formatDrawerPosition(code: string | null | undefined, slot: number | null | undefined) {
  const normalizedCode = normalizeStorageBinCode(code);
  if (!normalizedCode) return null;
  return slot ? `${normalizedCode}-${slot}` : normalizedCode;
}

export function formatItemPosition(input: {
  storageBin?: { code?: string | null } | null;
  bin?: string | null;
  binSlot?: number | null;
}) {
  return formatDrawerPosition(input.storageBin?.code || input.bin || null, input.binSlot || null);
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

async function resolveManualPlacement(
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

  const storageArea = normalizeOptionalText(input.storageArea);
  if (storageArea) {
    const shelf = await db.storageShelf.findFirst({
      where: { storageLocationId, name: storageArea },
      select: { id: true }
    });
    if (!shelf) {
      throw new Error("PLACEMENT_SHELF_INVALID");
    }
  }

  return {
    placementStatus: "PLACED" as const,
    storageLocationId,
    storageArea,
    bin: normalizeStorageBinCode(input.bin),
    storageBinId: null,
    binSlot: null,
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
      storageArea: true,
      slotCount: true,
      isActive: true
    }
  })) as StorageBinRecord | null;
  if (!storageBin || storageBin.isActive === false) {
    throw new Error("PLACEMENT_BIN_NOT_FOUND");
  }

  await ensureAllowedLocationId(storageBin.storageLocationId, input.allowedLocationIds);

  const binSlot = input.binSlot ?? null;
  if (!binSlot) {
    throw new Error("PLACEMENT_BIN_SLOT_REQUIRED");
  }
  if (binSlot < 1 || binSlot > storageBin.slotCount) {
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
    storageArea: storageBin.storageArea || null,
    bin: storageBin.code,
    storageBinId: storageBin.id,
    binSlot,
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
      storageArea: null,
      bin: null,
      storageBinId: null,
      binSlot: null,
      storageBin: null
    };
  }

  if (input.storageBinId) {
    return resolveManagedDrawerPlacement(db, input);
  }

  return resolveManualPlacement(db, input);
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
        storageArea: null,
        bin: null,
        storageBinId: null,
        binSlot: null,
        placementStatus: nextPlacementStatus
      }
    });
  }

  return preview;
}

export async function swapStorageBinContents(
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
      storageArea: true
    }
  });
  const leftBin = bins.find((entry) => entry.id === input.leftBinId);
  const rightBin = bins.find((entry) => entry.id === input.rightBinId);

  if (!leftBin || !rightBin) {
    throw new Error("STORAGE_BIN_NOT_FOUND");
  }
  if (
    leftBin.storageLocationId !== rightBin.storageLocationId ||
    normalizeOptionalText(leftBin.storageArea) !== normalizeOptionalText(rightBin.storageArea)
  ) {
    throw new Error("STORAGE_BIN_SWAP_SCOPE_MISMATCH");
  }

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

  const resetIds = [...leftItems.map((item) => item.id), ...rightItems.map((item) => item.id)];
  if (resetIds.length) {
    await db.item.updateMany({
      where: { id: { in: resetIds } },
      data: {
        storageLocationId: null,
        storageArea: null,
        bin: null,
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
        storageArea: rightBin.storageArea || null,
        bin: rightBin.code,
        storageBinId: rightBin.id,
        binSlot: item.binSlot,
        placementStatus: "PLACED"
      }
    });
  }

  for (const item of rightItems) {
    await db.item.update({
      where: { id: item.id },
      data: {
        storageLocationId: leftBin.storageLocationId,
        storageArea: leftBin.storageArea || null,
        bin: leftBin.code,
        storageBinId: leftBin.id,
        binSlot: item.binSlot,
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

export function mapPlacementError(error: unknown) {
  switch ((error as Error).message) {
    case "PLACEMENT_LOCATION_FORBIDDEN":
      return { status: 403, body: { error: "Storage location not allowed" } };
    case "PLACEMENT_LOCATION_REQUIRED":
      return { status: 400, body: { error: "Lagerort ist fuer eingelagerten Bestand erforderlich" } };
    case "PLACEMENT_LOCATION_NOT_FOUND":
      return { status: 400, body: { error: "Lagerort nicht gefunden" } };
    case "PLACEMENT_SHELF_INVALID":
      return { status: 400, body: { error: "Regal/Bereich ist fuer den Lagerort ungueltig" } };
    case "PLACEMENT_BIN_REQUIRED":
      return { status: 400, body: { error: "Drawer ist erforderlich" } };
    case "PLACEMENT_BIN_NOT_FOUND":
      return { status: 400, body: { error: "Drawer nicht gefunden" } };
    case "PLACEMENT_BIN_SLOT_REQUIRED":
      return { status: 400, body: { error: "Unterfach ist erforderlich" } };
    case "PLACEMENT_BIN_SLOT_INVALID":
      return { status: 400, body: { error: "Unterfach liegt ausserhalb der Drawer-Kapazitaet" } };
    case "PLACEMENT_BIN_SLOT_OCCUPIED":
      return { status: 409, body: { error: "Dieses Unterfach ist bereits belegt" } };
    case "STORAGE_BIN_NOT_FOUND":
      return { status: 404, body: { error: "Drawer nicht gefunden" } };
    case "STORAGE_BIN_SWAP_SCOPE_MISMATCH":
      return { status: 400, body: { error: "Drawer-Tausch ist nur innerhalb desselben Lagerorts und Regals moeglich" } };
    default:
      return null;
  }
}
