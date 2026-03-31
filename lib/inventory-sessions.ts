import type { Prisma, PrismaClient } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import { canSetStock } from "@/lib/stock";
import { QuantityValidationError, formatDisplayQuantity, serializeStoredQuantity, toStoredQuantity } from "@/lib/quantity";
import { formatDrawerPosition } from "@/lib/storage-bins";

type InventorySessionDb =
  | Pick<
      PrismaClient,
      | "inventorySession"
      | "inventorySessionRow"
      | "item"
      | "storageLocation"
      | "storageShelf"
      | "reservation"
      | "stockMovement"
      | "auditLog"
    >
  | Pick<
      Prisma.TransactionClient,
      | "inventorySession"
      | "inventorySessionRow"
      | "item"
      | "storageLocation"
      | "storageShelf"
      | "reservation"
      | "stockMovement"
      | "auditLog"
    >;

type SessionViewer = {
  id: string;
  role: string;
};

type SessionWithRows = {
  id: string;
  title: string | null;
  status: string;
  storageLocationId: string;
  storageArea: string | null;
  ownerUserId: string;
  createdByUserId: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
  cancelledAt: Date | null;
  storageLocation: {
    id: string;
    name: string;
    code: string | null;
  };
  ownerUser: {
    id: string;
    name: string;
    email: string;
  };
  createdByUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  rows: Array<{
    id: string;
    itemId: string;
    labelCode: string;
    name: string;
    unit: string;
    storageArea: string | null;
    storageShelfCode: string | null;
    storageBinCode: string | null;
    binSlot: number | null;
    expectedStock: number;
    countedStock: number | null;
    countedByUserId: string | null;
    countedAt: Date | null;
    note: string | null;
    countedByUser?: {
      id: string;
      name: string;
      email: string;
    } | null;
    item?: {
      id: string;
      labelCode: string;
      name: string;
      unit: string;
      stock: number;
      storageArea: string | null;
      storageShelf: { code: string | null } | null;
      storageBin: { code: string | null } | null;
      binSlot: number | null;
      deletedAt: Date | null;
      isArchived: boolean;
    } | null;
  }>;
};

export class InventorySessionError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "InventorySessionError";
    this.code = code;
    this.details = details;
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function compareOptionalText(left: string | null | undefined, right: string | null | undefined) {
  return String(left || "").localeCompare(String(right || ""), "de");
}

function buildScopeLabel(input: {
  storageLocationName?: string | null;
  storageArea?: string | null;
}) {
  return [input.storageLocationName || null, normalizeOptionalText(input.storageArea)].filter(Boolean).join(" / ") || "Unbekannt";
}

function compareOptionalNumber(left: number | null | undefined, right: number | null | undefined) {
  return (left || 0) - (right || 0);
}

function buildStoragePlaceLabel(input: {
  storageArea?: string | null;
  storageShelfCode?: string | null;
  storageBinCode?: string | null;
  binSlot?: number | null;
}) {
  return [
    normalizeOptionalText(input.storageArea),
    normalizeOptionalText(input.storageShelfCode),
    formatDrawerPosition(input.storageBinCode, input.binSlot)
  ]
    .filter(Boolean)
    .join(" / ") || "-";
}

function buildCountProgress(rows: Array<{ expectedStock: number; countedStock: number | null }>) {
  const countedRows = rows.filter((row) => row.countedStock !== null).length;
  const deltaRows = rows.filter((row) => row.countedStock !== null && row.countedStock !== row.expectedStock).length;
  return {
    totalRows: rows.length,
    countedRows,
    remainingRows: Math.max(0, rows.length - countedRows),
    deltaRows
  };
}

function isSessionOwnerOrAdmin(session: { ownerUserId: string }, viewer: SessionViewer) {
  return viewer.role === "ADMIN" || viewer.id === session.ownerUserId;
}

function isSessionEditor(session: { ownerUserId: string; status: string }, viewer: SessionViewer) {
  return session.status === "OPEN" && isSessionOwnerOrAdmin(session, viewer);
}

function assertLocationAllowed(storageLocationId: string, allowedLocationIds: string[] | null | undefined) {
  if (allowedLocationIds && !allowedLocationIds.includes(storageLocationId)) {
    throw new InventorySessionError("INVENTORY_SESSION_FORBIDDEN", "Forbidden");
  }
}

function buildFinalizeIssues(input: {
  rows: SessionWithRows["rows"];
  reservedQtyByItemId: Map<string, number>;
}) {
  const warnings: Array<{
    rowId: string;
    itemId: string;
    labelCode: string;
    severity: "warning" | "error";
    message: string;
  }> = [];

  for (const row of input.rows) {
    if (row.countedStock === null) continue;

    const currentItem = row.item || null;
    if (!currentItem || currentItem.deletedAt || currentItem.isArchived) {
      warnings.push({
        rowId: row.id,
        itemId: row.itemId,
        labelCode: row.labelCode,
        severity: "error",
        message: "Item ist nicht mehr aktiv und kann nicht finalisiert werden"
      });
      continue;
    }

    const reservedQty = input.reservedQtyByItemId.get(row.itemId) || 0;
    if (!canSetStock(row.countedStock, reservedQty)) {
      warnings.push({
        rowId: row.id,
        itemId: row.itemId,
        labelCode: row.labelCode,
        severity: "error",
        message: `Gezaehlter Bestand liegt unter reservierter Menge (${formatDisplayQuantity(row.unit, serializeStoredQuantity(row.unit, reservedQty))})`
      });
    }

    if (currentItem.stock !== row.expectedStock) {
      warnings.push({
        rowId: row.id,
        itemId: row.itemId,
        labelCode: row.labelCode,
        severity: "warning",
        message: `Live-Bestand hat sich seit Sessionstart geaendert (${formatDisplayQuantity(row.unit, serializeStoredQuantity(row.unit, currentItem.stock))} statt ${formatDisplayQuantity(row.unit, serializeStoredQuantity(row.unit, row.expectedStock))})`
      });
    }
  }

  return warnings;
}

async function buildReservedQtyByItemId(db: InventorySessionDb, itemIds: string[]) {
  if (!itemIds.length) return new Map<string, number>();

  const grouped = await db.reservation.groupBy({
    by: ["itemId"],
    where: { itemId: { in: itemIds } },
    _sum: { reservedQty: true }
  });

  return new Map(grouped.map((entry) => [entry.itemId, entry._sum.reservedQty || 0]));
}

export async function validateInventorySessionScope(
  db: InventorySessionDb,
  input: {
    storageLocationId: string;
    storageArea?: string | null;
    allowedLocationIds?: string[] | null;
  }
) {
  assertLocationAllowed(input.storageLocationId, input.allowedLocationIds);

  const location = await db.storageLocation.findUnique({
    where: { id: input.storageLocationId },
    select: { id: true, name: true, code: true }
  });
  if (!location) {
    throw new InventorySessionError("INVENTORY_SESSION_LOCATION_NOT_FOUND", "Lagerort nicht gefunden");
  }

  const storageArea = normalizeOptionalText(input.storageArea);
  if (storageArea) {
    const shelf = await db.storageShelf.findFirst({
      where: {
        storageLocationId: input.storageLocationId,
        name: storageArea
      },
      select: { id: true }
    });
    if (!shelf) {
      throw new InventorySessionError("INVENTORY_SESSION_SHELF_INVALID", "Regal/Bereich ist fuer den Lagerort ungueltig");
    }
  }

  return {
    location,
    storageArea
  };
}

export async function createInventorySession(
  db: InventorySessionDb,
  input: {
    storageLocationId: string;
    storageArea?: string | null;
    title?: string | null;
    note?: string | null;
    ownerUserId: string;
    createdByUserId?: string | null;
    allowedLocationIds?: string[] | null;
  }
) {
  const validatedScope = await validateInventorySessionScope(db, {
    storageLocationId: input.storageLocationId,
    storageArea: input.storageArea,
    allowedLocationIds: input.allowedLocationIds
  });

  const existingOpenSession = await db.inventorySession.findFirst({
    where: {
      storageLocationId: input.storageLocationId,
      status: "OPEN"
    },
    select: { id: true }
  });
  if (existingOpenSession) {
    throw new InventorySessionError("INVENTORY_SESSION_ALREADY_OPEN", "Fuer diesen Lagerort existiert bereits eine offene Inventur-Session");
  }

  const rows = await db.item.findMany({
    where: {
      storageLocationId: input.storageLocationId,
      storageArea: validatedScope.storageArea ?? undefined,
      deletedAt: null,
      isArchived: false
    },
    select: {
      id: true,
      labelCode: true,
      name: true,
      unit: true,
      storageArea: true,
      storageShelf: {
        select: { code: true }
      },
      storageBin: {
        select: { code: true }
      },
      binSlot: true,
      stock: true
    }
  });

  rows.sort(
    (left, right) =>
      compareOptionalText(left.storageArea, right.storageArea) ||
      compareOptionalText(left.storageShelf?.code, right.storageShelf?.code) ||
      compareOptionalText(left.storageBin?.code, right.storageBin?.code) ||
      compareOptionalNumber(left.binSlot, right.binSlot) ||
      left.labelCode.localeCompare(right.labelCode, "de")
  );

  const session = await db.inventorySession.create({
    data: {
      title: normalizeOptionalText(input.title),
      status: "OPEN",
      storageLocationId: input.storageLocationId,
      storageArea: validatedScope.storageArea,
      ownerUserId: input.ownerUserId,
      createdByUserId: input.createdByUserId || input.ownerUserId,
      note: normalizeOptionalText(input.note)
    },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      ownerUser: {
        select: { id: true, name: true, email: true }
      },
      createdByUser: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  if (rows.length) {
    await db.inventorySessionRow.createMany({
      data: rows.map((row) => ({
        sessionId: session.id,
        itemId: row.id,
        labelCode: row.labelCode,
        name: row.name,
        unit: row.unit,
        storageArea: normalizeOptionalText(row.storageArea),
        storageShelfCode: normalizeOptionalText(row.storageShelf?.code),
        storageBinCode: normalizeOptionalText(row.storageBin?.code),
        binSlot: row.binSlot ?? null,
        expectedStock: row.stock
      }))
    });
  }

  await auditLog(
    {
      userId: input.createdByUserId || input.ownerUserId,
      action: "INVENTORY_SESSION_CREATE",
      entity: "InventorySession",
      entityId: session.id,
      after: {
        title: session.title,
        status: session.status,
        storageLocationId: session.storageLocationId,
        storageLocationName: session.storageLocation.name,
        storageArea: session.storageArea,
        note: session.note,
        ownerUserId: session.ownerUserId,
        rowCount: rows.length
      }
    },
    db
  );

  return {
    ...session,
    rowCount: rows.length
  };
}

export function serializeInventorySessionListEntry(
  session: Omit<SessionWithRows, "rows"> & {
    rows: Array<{ expectedStock: number; countedStock: number | null }>;
  },
  viewer: SessionViewer
) {
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    storageLocationId: session.storageLocationId,
    storageArea: session.storageArea,
    note: session.note,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    finalizedAt: session.finalizedAt,
    cancelledAt: session.cancelledAt,
    storageLocation: session.storageLocation,
    ownerUser: session.ownerUser,
    createdByUser: session.createdByUser,
    scopeLabel: buildScopeLabel({
      storageLocationName: session.storageLocation.name,
      storageArea: session.storageArea
    }),
    progress: buildCountProgress(session.rows),
    canEdit: isSessionEditor(session, viewer)
  };
}

export async function buildInventorySessionDetail(
  db: InventorySessionDb,
  session: SessionWithRows,
  viewer: SessionViewer
) {
  const reservedQtyByItemId = await buildReservedQtyByItemId(
    db,
    Array.from(new Set(session.rows.map((row) => row.itemId)))
  );
  const warnings = buildFinalizeIssues({
    rows: session.rows,
    reservedQtyByItemId
  });
  const summary = {
    ...buildCountProgress(session.rows),
    warningCount: warnings.length,
    blockingCount: warnings.filter((warning) => warning.severity === "error").length
  };
  const canEdit = isSessionEditor(session, viewer);
  const canFinalize = canEdit && summary.blockingCount === 0;

  return {
    id: session.id,
    title: session.title,
    status: session.status,
    storageLocationId: session.storageLocationId,
    storageArea: session.storageArea,
    note: session.note,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    finalizedAt: session.finalizedAt,
    cancelledAt: session.cancelledAt,
    storageLocation: session.storageLocation,
    ownerUser: session.ownerUser,
    createdByUser: session.createdByUser,
    scopeLabel: buildScopeLabel({
      storageLocationName: session.storageLocation.name,
      storageArea: session.storageArea
    }),
    canEdit,
    canFinalize,
    summary,
    warnings,
    rows: session.rows
      .slice()
      .sort(
        (left, right) =>
          compareOptionalText(left.storageArea, right.storageArea) ||
          compareOptionalText(left.storageShelfCode, right.storageShelfCode) ||
          compareOptionalText(left.storageBinCode, right.storageBinCode) ||
          compareOptionalNumber(left.binSlot, right.binSlot) ||
          left.labelCode.localeCompare(right.labelCode, "de")
      )
      .map((row) => {
        const currentItem = row.item || null;
        const reservedQty = reservedQtyByItemId.get(row.itemId) || 0;
        return {
          id: row.id,
          itemId: row.itemId,
          labelCode: row.labelCode,
          name: row.name,
          unit: row.unit,
          storageArea: row.storageArea,
          storageShelfCode: row.storageShelfCode,
          storageBinCode: row.storageBinCode,
          binSlot: row.binSlot,
          storagePlaceLabel: buildStoragePlaceLabel(row),
          expectedStock: serializeStoredQuantity(row.unit, row.expectedStock),
          countedStock: serializeStoredQuantity(row.unit, row.countedStock),
          currentStock: currentItem ? serializeStoredQuantity(row.unit, currentItem.stock) : null,
          reservedQty: serializeStoredQuantity(row.unit, reservedQty),
          delta:
            row.countedStock === null ? null : serializeStoredQuantity(row.unit, row.countedStock - row.expectedStock),
          liveDelta:
            row.countedStock === null || !currentItem
              ? null
              : serializeStoredQuantity(row.unit, row.countedStock - currentItem.stock),
          currentStorageArea: currentItem?.storageArea || null,
          currentStorageShelfCode: currentItem?.storageShelf?.code || null,
          currentStorageBinCode: currentItem?.storageBin?.code || null,
          currentBinSlot: currentItem?.binSlot ?? null,
          currentStoragePlaceLabel: currentItem
            ? buildStoragePlaceLabel({
                storageArea: currentItem.storageArea,
                storageShelfCode: currentItem.storageShelf?.code || null,
                storageBinCode: currentItem.storageBin?.code || null,
                binSlot: currentItem.binSlot ?? null
              })
            : null,
          itemDeleted: !!currentItem?.deletedAt,
          itemArchived: !!currentItem?.isArchived,
          countedAt: row.countedAt,
          countedByUser: row.countedByUser || null,
          note: row.note,
          hasDrift: !!currentItem && currentItem.stock !== row.expectedStock
        };
      })
  };
}

export async function updateInventorySessionCounts(
  db: InventorySessionDb,
  input: {
    sessionId: string;
    counts: Array<{
      itemId: string;
      countedStock?: number | null;
      note?: string | null;
    }>;
    viewer: SessionViewer;
    allowedLocationIds?: string[] | null;
  }
) {
  const session = await db.inventorySession.findUnique({
    where: { id: input.sessionId },
    include: {
      rows: true
    }
  });
  if (!session) {
    throw new InventorySessionError("INVENTORY_SESSION_NOT_FOUND", "Inventur-Session nicht gefunden");
  }

  assertLocationAllowed(session.storageLocationId, input.allowedLocationIds);
  if (!isSessionOwnerOrAdmin(session, input.viewer)) {
    throw new InventorySessionError("INVENTORY_SESSION_FORBIDDEN", "Forbidden");
  }
  if (session.status !== "OPEN") {
    throw new InventorySessionError("INVENTORY_SESSION_READ_ONLY", "Inventur-Session ist bereits abgeschlossen");
  }

  const rowByItemId = new Map(session.rows.map((row) => [row.itemId, row]));
  let updatedCount = 0;

  for (const entry of input.counts) {
    const row = rowByItemId.get(entry.itemId);
    if (!row) {
      throw new InventorySessionError("INVENTORY_SESSION_ROW_NOT_FOUND", "Item ist nicht Teil dieser Inventur-Session");
    }

    const nextCountedStock =
      entry.countedStock !== undefined
        ? toStoredQuantity(row.unit, entry.countedStock, {
            field: `${row.labelCode} Ist-Bestand`,
            allowNegative: false,
            nullable: true
          })
        : row.countedStock;
    const nextNote = entry.note !== undefined ? normalizeOptionalText(entry.note) : row.note;

    const shouldResetCount = entry.countedStock !== undefined && nextCountedStock === null;
    const countedChanged = entry.countedStock !== undefined && nextCountedStock !== row.countedStock;
    const noteChanged = entry.note !== undefined && nextNote !== row.note;
    if (!countedChanged && !noteChanged) continue;

    await db.inventorySessionRow.update({
      where: { id: row.id },
      data: {
        countedStock: nextCountedStock,
        countedAt: entry.countedStock === undefined ? row.countedAt : shouldResetCount ? null : new Date(),
        countedByUserId: entry.countedStock === undefined ? row.countedByUserId : shouldResetCount ? null : input.viewer.id,
        note: nextNote
      }
    });
    updatedCount += 1;
  }

  return { updatedCount };
}

function buildInventoryMovementNote(session: {
  id: string;
  title: string | null;
}, row: { note: string | null }) {
  const parts = [session.title ? `Inventur-Session: ${session.title}` : `Inventur-Session ${session.id.slice(0, 8)}`];
  if (row.note) parts.push(row.note);
  return parts.join(" - ");
}

export async function finalizeInventorySession(
  db: InventorySessionDb,
  input: {
    sessionId: string;
    viewer: SessionViewer;
    allowedLocationIds?: string[] | null;
  }
) {
  const session = await db.inventorySession.findUnique({
    where: { id: input.sessionId },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      ownerUser: {
        select: { id: true, name: true, email: true }
      },
      createdByUser: {
        select: { id: true, name: true, email: true }
      },
      rows: {
        include: {
          item: {
            select: {
              id: true,
              labelCode: true,
              name: true,
              unit: true,
              stock: true,
              storageArea: true,
              storageShelf: {
                select: { code: true }
              },
              storageBin: {
                select: { code: true }
              },
              binSlot: true,
              deletedAt: true,
              isArchived: true
            }
          }
        }
      }
    }
  });
  if (!session) {
    throw new InventorySessionError("INVENTORY_SESSION_NOT_FOUND", "Inventur-Session nicht gefunden");
  }

  assertLocationAllowed(session.storageLocationId, input.allowedLocationIds);
  if (!isSessionOwnerOrAdmin(session, input.viewer)) {
    throw new InventorySessionError("INVENTORY_SESSION_FORBIDDEN", "Forbidden");
  }
  if (session.status !== "OPEN") {
    throw new InventorySessionError("INVENTORY_SESSION_READ_ONLY", "Inventur-Session ist bereits abgeschlossen");
  }

  const countedRows = session.rows.filter((row) => row.countedStock !== null);
  const reservedQtyByItemId = await buildReservedQtyByItemId(
    db,
    Array.from(new Set(countedRows.map((row) => row.itemId)))
  );
  const blockingIssues = buildFinalizeIssues({
    rows: session.rows,
    reservedQtyByItemId
  }).filter((warning) => warning.severity === "error");

  if (blockingIssues.length) {
    throw new InventorySessionError(
      "INVENTORY_SESSION_BLOCKED",
      "Inventur-Session kann nicht finalisiert werden",
      { blockers: blockingIssues }
    );
  }

  const appliedRows: Array<{
    itemId: string;
    rowId: string;
    delta: number;
    unit: string;
  }> = [];

  for (const row of countedRows) {
    const currentItem = row.item;
    if (!currentItem) continue;
    const delta = row.countedStock! - currentItem.stock;

    if (delta !== 0) {
      await db.item.update({
        where: { id: currentItem.id },
        data: {
          stock: row.countedStock!
        }
      });

      await db.stockMovement.create({
        data: {
          itemId: currentItem.id,
          inventorySessionId: session.id,
          delta,
          reason: "INVENTORY",
          note: buildInventoryMovementNote(session, row),
          userId: input.viewer.id
        }
      });
    }

    appliedRows.push({
      itemId: currentItem.id,
      rowId: row.id,
      delta,
      unit: row.unit
    });
  }

  const finalizedSession = await db.inventorySession.update({
    where: { id: session.id },
    data: {
      status: "FINALIZED",
      finalizedAt: new Date()
    }
  });

  await auditLog(
    {
      userId: input.viewer.id,
      action: "INVENTORY_SESSION_FINALIZE",
      entity: "InventorySession",
      entityId: session.id,
      before: {
        status: session.status
      },
      after: {
        status: finalizedSession.status,
        finalizedAt: finalizedSession.finalizedAt,
        countedRows: countedRows.length,
        changedRows: appliedRows.filter((row) => row.delta !== 0).length,
        scopeLabel: buildScopeLabel({
          storageLocationName: session.storageLocation.name,
          storageArea: session.storageArea
        })
      }
    },
    db
  );

  return {
    countedRows: countedRows.length,
    changedRows: appliedRows.filter((row) => row.delta !== 0).length,
    appliedRows: appliedRows.map((row) => ({
      ...row,
      delta: serializeStoredQuantity(row.unit, row.delta)
    }))
  };
}

export async function cancelInventorySession(
  db: InventorySessionDb,
  input: {
    sessionId: string;
    viewer: SessionViewer;
    allowedLocationIds?: string[] | null;
  }
) {
  const session = await db.inventorySession.findUnique({
    where: { id: input.sessionId },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      }
    }
  });
  if (!session) {
    throw new InventorySessionError("INVENTORY_SESSION_NOT_FOUND", "Inventur-Session nicht gefunden");
  }

  assertLocationAllowed(session.storageLocationId, input.allowedLocationIds);
  if (!isSessionOwnerOrAdmin(session, input.viewer)) {
    throw new InventorySessionError("INVENTORY_SESSION_FORBIDDEN", "Forbidden");
  }
  if (session.status !== "OPEN") {
    throw new InventorySessionError("INVENTORY_SESSION_READ_ONLY", "Inventur-Session ist bereits abgeschlossen");
  }

  const cancelledSession = await db.inventorySession.update({
    where: { id: session.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date()
    }
  });

  await auditLog(
    {
      userId: input.viewer.id,
      action: "INVENTORY_SESSION_CANCEL",
      entity: "InventorySession",
      entityId: session.id,
      before: {
        status: session.status
      },
      after: {
        status: cancelledSession.status,
        cancelledAt: cancelledSession.cancelledAt,
        scopeLabel: buildScopeLabel({
          storageLocationName: session.storageLocation.name,
          storageArea: session.storageArea
        })
      }
    },
    db
  );

  return cancelledSession;
}

export function mapInventorySessionError(error: unknown) {
  if (error instanceof QuantityValidationError) {
    return { status: 400, body: { error: error.message, field: error.field || null } };
  }
  if (!(error instanceof InventorySessionError)) {
    return null;
  }

  switch (error.code) {
    case "INVENTORY_SESSION_FORBIDDEN":
      return { status: 403, body: { error: "Forbidden" } };
    case "INVENTORY_SESSION_LOCATION_NOT_FOUND":
      return { status: 400, body: { error: "Lagerort nicht gefunden" } };
    case "INVENTORY_SESSION_SHELF_INVALID":
      return { status: 400, body: { error: "Regal/Bereich ist fuer den Lagerort ungueltig" } };
    case "INVENTORY_SESSION_ALREADY_OPEN":
      return { status: 400, body: { error: error.message } };
    case "INVENTORY_SESSION_NOT_FOUND":
      return { status: 404, body: { error: error.message } };
    case "INVENTORY_SESSION_ROW_NOT_FOUND":
      return { status: 400, body: { error: error.message } };
    case "INVENTORY_SESSION_READ_ONLY":
      return { status: 400, body: { error: error.message } };
    case "INVENTORY_SESSION_BLOCKED":
      return { status: 400, body: { error: error.message, details: error.details || null } };
    default:
      return { status: 400, body: { error: error.message } };
  }
}
