import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { bulkTransferSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";
import { canWrite, resolveAllowedLocationIds } from "@/lib/permissions";
import { applyItemTransfer, buildTransferSourceGroups, validateTransferTarget } from "@/lib/item-transfer";
import { formatDrawerPosition } from "@/lib/storage-labels";

function buildBlockedItem(item: { id: string; labelCode: string; name: string }, reason: string) {
  return {
    itemId: item.id,
    labelCode: item.labelCode,
    name: item.name,
    reason
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, bulkTransferSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof bulkTransferSchema.parse>;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const items = await prisma.item.findMany({
    where: { id: { in: body.itemIds } },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      }
    },
    orderBy: { labelCode: "asc" }
  });

  const blockedItems = body.itemIds
    .filter((itemId) => !items.some((item) => item.id === itemId))
    .map((itemId) => ({
      itemId,
      labelCode: "",
      name: "",
      reason: "Item nicht gefunden"
    }));

  if (allowedLocationIds) {
    blockedItems.push(
      ...items
        .filter((item) => item.storageLocationId ? !allowedLocationIds.includes(item.storageLocationId) : !canWrite(auth.user!.role))
        .map((item) => buildBlockedItem(item, "Quelle ausserhalb des erlaubten Lager-Scope"))
    );
  }

  let validatedTarget:
    | Awaited<ReturnType<typeof validateTransferTarget>>
    | null = null;
  let targetError: string | null = null;
  try {
    validatedTarget = await validateTransferTarget(prisma, {
      storageLocationId: body.storageLocationId,
      storageShelfId: body.storageShelfId || null,
      storageBinId: body.storageBinId || null,
      binSlot: body.binSlot ?? null,
      allowedLocationIds
    });
  } catch (error) {
    switch ((error as Error).message) {
      case "TRANSFER_TARGET_FORBIDDEN":
        targetError = "Ziel ausserhalb des erlaubten Lager-Scope";
        break;
      case "TRANSFER_TARGET_LOCATION_NOT_FOUND":
        targetError = "Ziel-Lagerort nicht gefunden";
        break;
      case "TRANSFER_TARGET_SHELF_INVALID":
        targetError = "Regal/Bereich ist fuer den Ziel-Lagerort ungueltig";
        break;
      default:
        throw error;
    }
  }

  const previewPayload = {
    dryRun: !!body.dryRun,
    ok: blockedItems.length === 0 && !targetError,
    count: body.itemIds.length,
    transferableCount: blockedItems.length === 0 && !targetError ? items.length : 0,
    sourceGroups: buildTransferSourceGroups(items),
    target: validatedTarget
      ? {
          storageLocationId: validatedTarget.location.id,
          storageLocationName: validatedTarget.location.name,
          storageShelfId: validatedTarget.storageShelf.id,
          storageShelfCode: validatedTarget.storageShelf.code || null,
          storageShelfName: validatedTarget.storageShelf.name,
          storageBinId: validatedTarget.storageBin?.id || null,
          storageBinCode: validatedTarget.storageBin?.code || null,
          binSlot: validatedTarget.binSlot ?? null,
          storageArea: validatedTarget.storageShelf.name,
          bin: validatedTarget.storageBin?.code
            ? formatDrawerPosition(
                validatedTarget.storageBin.code,
                validatedTarget.binSlot ?? null,
                validatedTarget.storageBin.slotCount ?? null,
                validatedTarget.storageShelf.code || null
              )
            : null
        }
      : {
          storageLocationId: body.storageLocationId,
          storageLocationName: null,
          storageShelfId: body.storageShelfId,
          storageShelfCode: null,
          storageShelfName: null,
          storageBinId: body.storageBinId || null,
          storageBinCode: null,
          binSlot: body.binSlot ?? null,
          storageArea: null,
          bin: null
        },
    blockedItems,
    targetError
  };

  if (body.dryRun) {
    return NextResponse.json(previewPayload);
  }

  if (blockedItems.length || targetError || !validatedTarget) {
    return NextResponse.json(previewPayload, { status: 400 });
  }

  const transferredItems = await prisma.$transaction(async (tx) => {
    const moved: Array<{ id: string; labelCode: string; name: string }> = [];

    for (const item of items) {
      const result = await applyItemTransfer(tx, {
        item,
        target: {
          storageLocationId: validatedTarget.location.id,
          storageShelfId: validatedTarget.storageShelf.id,
          storageBinId: validatedTarget.storageBin?.id || null,
          binSlot: validatedTarget.binSlot ?? null
        },
        userId: auth.user!.id,
        note: body.note,
        sourceLocation: item.storageLocation,
        targetLocation: validatedTarget.location,
        targetShelf: validatedTarget.storageShelf,
        targetBin: validatedTarget.storageBin
      });

      if (result.changed) {
        moved.push({
          id: item.id,
          labelCode: item.labelCode,
          name: item.name
        });
      }
    }

    return moved;
  });

  return NextResponse.json({
    ...previewPayload,
    dryRun: false,
    ok: true,
    transferableCount: transferredItems.length,
    transferredItems
  });
}
