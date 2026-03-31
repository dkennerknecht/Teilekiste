import type { Prisma, PrismaClient } from "@prisma/client";
import { auditLog } from "@/lib/audit";

type TransferDb =
  | Pick<PrismaClient, "item" | "storageLocation" | "storageShelf" | "auditLog">
  | Pick<Prisma.TransactionClient, "item" | "storageLocation" | "storageShelf" | "auditLog">;

type TransferItem = {
  id: string;
  labelCode?: string | null;
  name?: string | null;
  storageLocationId: string | null;
  storageArea?: string | null;
  bin?: string | null;
  storageLocation?: { id: string; name: string; code?: string | null } | null;
};

type TransferTarget = {
  storageLocationId: string;
  storageArea?: string | null;
  bin?: string | null;
};

type TransferLocationMeta = {
  id: string;
  name: string;
  code?: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function describeStoragePlace(input: {
  storageLocationName?: string | null;
  storageLocationId?: string | null;
  storageArea?: string | null;
  bin?: string | null;
}) {
  return {
    storageLocationId: input.storageLocationId || null,
    storageLocationName: input.storageLocationName || input.storageLocationId || null,
    storageArea: normalizeOptionalText(input.storageArea),
    bin: normalizeOptionalText(input.bin)
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

export async function validateTransferTarget(
  db: TransferDb,
  input: {
    storageLocationId: string;
    storageArea?: string | null;
    allowedLocationIds?: string[] | null;
  }
) {
  if (input.allowedLocationIds && !input.allowedLocationIds.includes(input.storageLocationId)) {
    throw new Error("TRANSFER_TARGET_FORBIDDEN");
  }

  const location = await db.storageLocation.findUnique({
    where: { id: input.storageLocationId },
    select: { id: true, name: true, code: true }
  });
  if (!location) {
    throw new Error("TRANSFER_TARGET_LOCATION_NOT_FOUND");
  }

  const normalizedStorageArea = normalizeOptionalText(input.storageArea);
  if (normalizedStorageArea) {
    const shelf = await db.storageShelf.findFirst({
      where: {
        storageLocationId: input.storageLocationId,
        name: normalizedStorageArea
      },
      select: { id: true }
    });
    if (!shelf) {
      throw new Error("TRANSFER_TARGET_SHELF_INVALID");
    }
  }

  return {
    location,
    storageArea: normalizedStorageArea
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
    targetLocation?: TransferLocationMeta | null;
  }
) {
  const normalizedTarget = {
    storageLocationId: input.target.storageLocationId,
    storageArea: normalizeOptionalText(input.target.storageArea),
    bin: normalizeOptionalText(input.target.bin)
  };
  const currentSource = {
    storageLocationId: input.item.storageLocationId,
    storageArea: normalizeOptionalText(input.item.storageArea),
    bin: normalizeOptionalText(input.item.bin)
  };

  const changed =
    currentSource.storageLocationId !== normalizedTarget.storageLocationId ||
    currentSource.storageArea !== normalizedTarget.storageArea ||
    currentSource.bin !== normalizedTarget.bin;

  if (!changed) {
    return {
      changed: false as const,
      item: input.item
    };
  }

  const updatedItem = await db.item.update({
    where: { id: input.item.id },
    data: {
      storageLocationId: normalizedTarget.storageLocationId,
      storageArea: normalizedTarget.storageArea,
      bin: normalizedTarget.bin
    }
  });

  const { sourceLocation, targetLocation } = await resolveLocationMeta(
    db,
    input.item.storageLocationId,
    normalizedTarget.storageLocationId,
    input.sourceLocation || input.item.storageLocation || null,
    input.targetLocation || null
  );
  const note = normalizeOptionalText(input.note);

  await auditLog(
    {
      userId: input.userId,
      action: "ITEM_TRANSFER",
      entity: "Item",
      entityId: input.item.id,
      before: describeStoragePlace({
        storageLocationId: input.item.storageLocationId,
        storageLocationName: sourceLocation.name,
        storageArea: currentSource.storageArea,
        bin: currentSource.bin
      }),
      after: {
        ...describeStoragePlace({
          storageLocationId: normalizedTarget.storageLocationId,
          storageLocationName: targetLocation.name,
          storageArea: normalizedTarget.storageArea,
          bin: normalizedTarget.bin
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
  items: Array<TransferItem & { storageLocation?: TransferLocationMeta | null }>
) {
  const groups = new Map<
    string,
    {
      storageLocationId: string;
      storageLocationName: string;
      storageArea: string | null;
      bin: string | null;
      count: number;
    }
  >();

  for (const item of items) {
    const storageArea = normalizeOptionalText(item.storageArea);
    const bin = normalizeOptionalText(item.bin);
    const key = [item.storageLocationId || "unplaced", storageArea || "", bin || ""].join("::");
    const current = groups.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    groups.set(key, {
      storageLocationId: item.storageLocationId || "unplaced",
      storageLocationName: item.storageLocation?.name || item.storageLocationId || "Unplaced",
      storageArea,
      bin,
      count: 1
    });
  }

  return Array.from(groups.values()).sort(
    (left, right) =>
      left.storageLocationName.localeCompare(right.storageLocationName, "de") ||
      String(left.storageArea || "").localeCompare(String(right.storageArea || ""), "de") ||
      String(left.bin || "").localeCompare(String(right.bin || ""), "de")
  );
}
