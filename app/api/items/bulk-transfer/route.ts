import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { bulkTransferSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";
import { canWrite, resolveAllowedLocationIds } from "@/lib/permissions";
import { applyItemTransfer, buildTransferSourceGroups, validateTransferTarget } from "@/lib/item-transfer";

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
      storageArea: body.storageArea,
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
          storageArea: validatedTarget.storageArea,
          bin: body.bin?.trim() || null
        }
      : {
          storageLocationId: body.storageLocationId,
          storageLocationName: null,
          storageArea: body.storageArea?.trim() || null,
          bin: body.bin?.trim() || null
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
          storageArea: validatedTarget.storageArea,
          bin: body.bin
        },
        userId: auth.user!.id,
        note: body.note,
        sourceLocation: item.storageLocation,
        targetLocation: validatedTarget.location
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
