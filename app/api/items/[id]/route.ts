import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWriteAccess } from "@/lib/api";
import { itemUpdateSchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit";
import { summarizeAuditEntry } from "@/lib/audit-view";
import { assignNextLabelCode } from "@/lib/label-code";
import { loadItemBom } from "@/lib/item-bom";
import { applyItemTransfer, validateTransferTarget } from "@/lib/item-transfer";
import { canWrite, resolveAllowedLocationIds } from "@/lib/permissions";
import { canSetStock, getAvailableQty, getReservedQty } from "@/lib/stock";
import { CustomFieldValidationError, prepareCustomFieldValueWrites } from "@/lib/custom-fields";
import { QuantityValidationError, serializeStoredQuantity, toStoredQuantity } from "@/lib/quantity";
import { parseJson } from "@/lib/http";
import { formatItemPosition, mapPlacementError, normalizePlacementStatus, resolveItemPlacement } from "@/lib/storage-bins";

function safeParseAuditPayload(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function serializeItemDetailQuantities(item: any, reservedQty: number) {
  return {
    ...item,
    stock: serializeStoredQuantity(item.unit, item.stock),
    incomingQty: serializeStoredQuantity(item.unit, item.incomingQty ?? 0),
    minStock: serializeStoredQuantity(item.unit, item.minStock),
    movements: (item.movements || []).map((movement: any) => ({
      ...movement,
      delta: serializeStoredQuantity(item.unit, movement.delta)
    })),
    reservations: (item.reservations || []).map((reservation: any) => ({
      ...reservation,
      reservedQty: serializeStoredQuantity(item.unit, reservation.reservedQty)
    })),
    reservedQty: serializeStoredQuantity(item.unit, reservedQty),
    availableStock: serializeStoredQuantity(item.unit, getAvailableQty(item.stock, reservedQty, item.placementStatus)),
    displayBin: formatItemPosition(item)
  };
}

function mapTransferError(error: unknown) {
  switch ((error as Error).message) {
    case "TRANSFER_TARGET_FORBIDDEN":
      return { status: 403, body: { error: "Forbidden" } };
    case "TRANSFER_TARGET_LOCATION_NOT_FOUND":
      return { status: 400, body: { error: "Ziel-Lagerort nicht gefunden" } };
    case "TRANSFER_TARGET_SHELF_INVALID":
      return { status: 400, body: { error: "Regal/Bereich ist fuer den Ziel-Lagerort ungueltig" } };
    default:
      return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const item = await prisma.item.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      labelType: true,
      storageLocation: true,
      storageBin: {
        select: {
          id: true,
          code: true,
          slotCount: true,
          storageLocationId: true,
          storageArea: true
        }
      },
      tags: { include: { tag: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      attachments: true,
      movements: { orderBy: { createdAt: "desc" }, include: { user: true }, take: 30 },
      reservations: { orderBy: { createdAt: "desc" }, include: { user: true }, take: 30 },
      customValues: { include: { customField: true } }
    }
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (item.mergedIntoItemId) {
    const mergedTarget = await prisma.item.findUnique({
      where: { id: item.mergedIntoItemId },
      select: { id: true, storageLocationId: true }
    });
    if (!mergedTarget) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const mergedAllowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
    if (
      mergedTarget.storageLocationId &&
      mergedAllowedLocationIds &&
      !mergedAllowedLocationIds.includes(mergedTarget.storageLocationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!mergedTarget.storageLocationId && auth.user!.role !== "ADMIN" && !canWrite(auth.user!.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ redirectToItemId: mergedTarget.id });
  }

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (item.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!item.storageLocationId && auth.user!.role !== "ADMIN" && !canWrite(auth.user!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ bomChildren, bomParents }, auditEntries, reservationHistoryEntries] = await Promise.all([
    loadItemBom(item.id, allowedLocationIds),
    auth.user!.role === "ADMIN"
      ? prisma.auditLog.findMany({
          where: {
            entity: "Item",
            entityId: item.id
          },
          include: {
            user: {
              select: { name: true, email: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 25
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: {
        entity: "Item",
        entityId: item.id,
        action: {
          in: ["RESERVATION_CREATE", "RESERVATION_DELETE"]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);

  await prisma.recentView.upsert({
    where: { userId_itemId: { userId: auth.user!.id, itemId: item.id } },
    update: { lastViewedAt: new Date() },
    create: { userId: auth.user!.id, itemId: item.id }
  });

  const reservedQty = getReservedQty(item.reservations);
  return NextResponse.json({
    ...serializeItemDetailQuantities(item, reservedQty),
    bomChildren,
    bomParents,
    auditEntries: auditEntries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      createdAt: entry.createdAt,
      user: entry.user,
      summary: summarizeAuditEntry(entry)
    })),
    reservationHistoryEntries: reservationHistoryEntries.map((entry) => {
      const payload = safeParseAuditPayload(entry.after) || safeParseAuditPayload(entry.before);
      return {
        id: entry.id,
        action: entry.action,
        reservationId: payload?.reservationId || null,
        createdAt: entry.createdAt,
        text: summarizeAuditEntry(entry)
      };
    }),
    primaryImage: item.images[0] ?? null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, itemUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof itemUpdateSchema.parse>;

  const existing = await prisma.item.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const reservedQtyResult = await prisma.reservation.aggregate({
    where: { itemId: params.id },
    _sum: { reservedQty: true }
  });
  const reservedQty = reservedQtyResult._sum.reservedQty || 0;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (existing.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(existing.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!existing.storageLocationId && auth.user!.role !== "ADMIN" && !canWrite(auth.user!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (body.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(body.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const nextUnit = body.unit || existing.unit;
  const unitChanged = nextUnit !== existing.unit;

  if (unitChanged) {
    const [movementCount, reservationCount] = await Promise.all([
      prisma.stockMovement.count({ where: { itemId: existing.id } }),
      prisma.reservation.count({ where: { itemId: existing.id } })
    ]);
    if (movementCount > 0 || reservationCount > 0) {
      return NextResponse.json(
        { error: "Einheitenwechsel ist nur moeglich, solange noch keine Bewegungen oder Reservierungen existieren" },
        { status: 400 }
      );
    }
  }

  let nextStock: number | undefined;
  let nextIncomingQty: number | undefined;
  let nextMinStock: number | null | undefined;
  try {
    if (body.stock !== undefined || unitChanged) {
      nextStock = toStoredQuantity(nextUnit, body.stock !== undefined ? body.stock : serializeStoredQuantity(existing.unit, existing.stock), {
        field: "Bestand",
        allowNegative: false
      })!;
    }
    if (body.incomingQty !== undefined || unitChanged) {
      nextIncomingQty = toStoredQuantity(
        nextUnit,
        body.incomingQty !== undefined ? body.incomingQty : serializeStoredQuantity(existing.unit, existing.incomingQty),
        {
          field: "Erwartete Menge",
          allowNegative: false
        }
      )!;
    }
    if (body.minStock !== undefined || unitChanged) {
      nextMinStock = toStoredQuantity(
        nextUnit,
        body.minStock !== undefined ? body.minStock : serializeStoredQuantity(existing.unit, existing.minStock),
        {
          field: "Mindestbestand",
          allowNegative: false,
          nullable: true
        }
      );
    }
  } catch (error) {
    if (error instanceof QuantityValidationError) {
      return NextResponse.json({ error: error.message, field: error.field || null }, { status: 400 });
    }
    throw error;
  }

  if (nextStock !== undefined && !canSetStock(nextStock, reservedQty)) {
    return NextResponse.json({ error: "Bestand darf nicht unter die reservierte Menge fallen" }, { status: 400 });
  }

  const {
    tagIds,
    customValues: _customValues,
    typeId: _typeId,
    categoryId,
    placementStatus: _placementStatus,
    storageBinId: _storageBinId,
    binSlot: _binSlot,
    storageLocationId: _storageLocationId,
    storageArea: _storageArea,
    bin: _bin,
    stock: _stock,
    incomingQty: _incomingQty,
    unit: _unit,
    minStock: _minStock,
    ...itemData
  } = body;
  const nextCategoryId = body.categoryId || existing.categoryId;
  const nextTypeId = body.typeId === undefined ? existing.typeId || null : body.typeId || null;
  const shouldRegenerateLabel =
    !!nextTypeId && ((!!body.categoryId && body.categoryId !== existing.categoryId) || !!body.typeId);
  const labelCode = shouldRegenerateLabel ? await assignNextLabelCode(nextCategoryId, nextTypeId) : existing.labelCode;
  let customFieldWrites: Awaited<ReturnType<typeof prepareCustomFieldValueWrites>> | null = null;

  if (body.customValues) {
    try {
      customFieldWrites = await prepareCustomFieldValueWrites(prisma, {
        rawValues: body.customValues,
        categoryId: nextCategoryId,
        typeId: nextTypeId
      });
    } catch (error) {
      if (error instanceof CustomFieldValidationError) {
        return NextResponse.json({ error: error.message, fieldId: error.fieldId || null }, { status: 400 });
      }
      throw error;
    }
  }

  const placementFieldKeys = ["placementStatus", "storageBinId", "binSlot", "storageLocationId", "storageArea", "bin"];
  const hasRequestedPlacementChanges = placementFieldKeys.some((key) => key in body);
  const targetStorageLocationId = body.storageLocationId !== undefined ? body.storageLocationId || null : existing.storageLocationId || null;
  const targetStorageArea =
    body.storageArea !== undefined
      ? body.storageArea?.trim() || null
      : body.storageLocationId && body.storageLocationId !== existing.storageLocationId
        ? null
        : existing.storageArea || null;
  const targetBin = body.bin !== undefined ? body.bin?.trim() || null : existing.bin || null;
  const locationChanged =
    targetStorageLocationId !== existing.storageLocationId ||
    targetStorageArea !== (existing.storageArea || null) ||
    targetBin !== (existing.bin || null);
  const usesLegacyTransferOnly =
    locationChanged &&
    !("placementStatus" in body) &&
    !("storageBinId" in body) &&
    !("binSlot" in body);
  let resolvedPlacement = {
    placementStatus: normalizePlacementStatus(existing.placementStatus, "PLACED"),
    storageLocationId: existing.storageLocationId || null,
    storageArea: existing.storageArea || null,
    bin: existing.bin || null,
    storageBinId: existing.storageBinId || null,
    binSlot: existing.binSlot ?? null
  };
  if (hasRequestedPlacementChanges && !usesLegacyTransferOnly) {
    try {
      resolvedPlacement = await resolveItemPlacement(prisma, {
        placementStatus: body.placementStatus ?? existing.placementStatus,
        storageLocationId: body.storageLocationId !== undefined ? body.storageLocationId || null : existing.storageLocationId || null,
        storageArea: body.storageArea !== undefined ? body.storageArea || null : existing.storageArea || null,
        bin: body.bin !== undefined ? body.bin || null : existing.bin || null,
        storageBinId: body.storageBinId !== undefined ? body.storageBinId || null : existing.storageBinId || null,
        binSlot: body.binSlot !== undefined ? body.binSlot ?? null : existing.binSlot ?? null,
        allowedLocationIds,
        existingItemId: existing.id
      });
    } catch (error) {
      const placementError = mapPlacementError(error);
      if (placementError) {
        return NextResponse.json(placementError.body, { status: placementError.status });
      }
      throw error;
    }
  }
  const placementChanged =
    resolvedPlacement.placementStatus !== normalizePlacementStatus(existing.placementStatus, "PLACED") ||
    resolvedPlacement.storageLocationId !== (existing.storageLocationId || null) ||
    resolvedPlacement.storageArea !== (existing.storageArea || null) ||
    resolvedPlacement.bin !== (existing.bin || null) ||
    resolvedPlacement.storageBinId !== (existing.storageBinId || null) ||
    resolvedPlacement.binSlot !== (existing.binSlot ?? null);
  const hasRequestedNonTransferChanges = Object.keys(body).some(
    (key) => !["storageLocationId", "storageArea", "bin"].includes(key)
  );

  if (!locationChanged && !placementChanged && !hasRequestedNonTransferChanges) {
    return NextResponse.json({
      ...existing,
      stock: serializeStoredQuantity(existing.unit, existing.stock),
      incomingQty: serializeStoredQuantity(existing.unit, existing.incomingQty),
      minStock: serializeStoredQuantity(existing.unit, existing.minStock),
      displayBin: formatItemPosition(existing as never)
    });
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      let workingItem = existing;

      if (locationChanged && usesLegacyTransferOnly) {
        if (existing.storageBinId) {
          const siblingCount = await tx.item.count({
            where: {
              storageBinId: existing.storageBinId,
              id: { not: existing.id },
              deletedAt: null,
              isArchived: false,
              mergedIntoItemId: null
            }
          });
          if (siblingCount > 0) {
            throw new Error("SHARED_DRAWER_SPLIT_BLOCKED");
          }
        }
        const validatedTarget = await validateTransferTarget(tx, {
          storageLocationId: targetStorageLocationId!,
          storageArea: targetStorageArea,
          allowedLocationIds
        });
        const transferResult = await applyItemTransfer(tx, {
          item: existing,
          target: {
            storageLocationId: validatedTarget.location.id,
            storageArea: validatedTarget.storageArea,
            bin: targetBin
          },
          userId: auth.user!.id,
          sourceLocation: null,
          targetLocation: validatedTarget.location
        });
        workingItem = transferResult.item as typeof existing;
      }

      if (!hasRequestedNonTransferChanges) {
        return workingItem;
      }

      const nextLabelCode = shouldRegenerateLabel ? await assignNextLabelCode(nextCategoryId, nextTypeId, tx) : existing.labelCode;
      const updatedItem = await tx.item.update({
        where: { id: params.id },
        data: {
          ...itemData,
          labelCode: nextLabelCode,
          ...(categoryId ? { categoryId } : {}),
          ...(nextStock !== undefined ? { stock: nextStock } : {}),
          ...(nextIncomingQty !== undefined ? { incomingQty: nextIncomingQty } : {}),
          ...(body.unit !== undefined ? { unit: nextUnit } : {}),
          ...(body.typeId !== undefined ? { typeId: nextTypeId } : {}),
          ...(hasRequestedPlacementChanges && !usesLegacyTransferOnly
            ? {
                placementStatus: resolvedPlacement.placementStatus,
                storageLocationId: resolvedPlacement.storageLocationId,
                storageArea: resolvedPlacement.storageArea,
                bin: resolvedPlacement.bin,
                storageBinId: resolvedPlacement.storageBinId,
                binSlot: resolvedPlacement.binSlot
              }
            : {}),
          minStock: nextMinStock === undefined ? undefined : nextMinStock,
          manufacturer: itemData.manufacturer || null,
          mpn: itemData.mpn || null,
          ...(tagIds
            ? {
                tags: {
                  deleteMany: {},
                  create: tagIds.map((tagId) => ({ tagId }))
                }
              }
            : {})
        }
      });

      if (customFieldWrites) {
        await Promise.all(
          customFieldWrites.upserts.map((entry) =>
            tx.itemCustomFieldValue.upsert({
              where: { itemId_customFieldId: { itemId: updatedItem.id, customFieldId: entry.customFieldId } },
              update: { valueJson: entry.valueJson },
              create: { itemId: updatedItem.id, customFieldId: entry.customFieldId, valueJson: entry.valueJson }
            })
          )
        );
        if (customFieldWrites.deletions.length) {
          await tx.itemCustomFieldValue.deleteMany({
            where: {
              itemId: updatedItem.id,
              customFieldId: { in: customFieldWrites.deletions }
            }
          });
        }
      }

      const auditBefore = locationChanged
        ? {
            ...existing,
            storageLocationId: targetStorageLocationId,
            storageArea: targetStorageArea,
            bin: targetBin
          }
        : existing;
      await auditLog(
        {
          userId: auth.user!.id,
          action: "ITEM_UPDATE",
          entity: "Item",
          entityId: updatedItem.id,
          before: auditBefore,
          after: updatedItem
        },
        tx
      );

      return updatedItem;
    });

    return NextResponse.json({
      ...item,
      stock: serializeStoredQuantity(item.unit, item.stock),
      incomingQty: serializeStoredQuantity(item.unit, item.incomingQty),
      minStock: serializeStoredQuantity(item.unit, item.minStock),
      displayBin: formatItemPosition(item as never)
    });
  } catch (error) {
    if ((error as Error).message === "SHARED_DRAWER_SPLIT_BLOCKED") {
      return NextResponse.json(
        { error: "Ein einzelnes Item kann nicht direkt aus einem mehrfach belegten Drawer transferiert werden" },
        { status: 409 }
      );
    }
    const transferError = mapTransferError(error);
    if (transferError) {
      return NextResponse.json(transferError.body, { status: transferError.status });
    }
    const placementError = mapPlacementError(error);
    if (placementError) {
      return NextResponse.json(placementError.body, { status: placementError.status });
    }
    throw error;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const existing = await prisma.item.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (existing.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(existing.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!existing.storageLocationId && auth.user!.role !== "ADMIN" && !canWrite(auth.user!.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await prisma.item.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await auditLog({
    userId: auth.user!.id,
    action: "ITEM_SOFT_DELETE",
    entity: "Item",
    entityId: item.id,
    before: existing,
    after: item
  });

  return NextResponse.json({ ok: true });
}
