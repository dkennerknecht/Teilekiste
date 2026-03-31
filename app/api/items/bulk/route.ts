import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/api";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { assignNextLabelCode, previewBulkLabelCodes } from "@/lib/label-code";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { bulkItemSchema } from "@/lib/validation";
import { QuantityValidationError, serializeStoredQuantity, toStoredQuantity } from "@/lib/quantity";
import { parseJson } from "@/lib/http";

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, bulkItemSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof bulkItemSchema.parse>;
  const itemIds = body.itemIds;
  const actionFlags = [body.deleteItems, body.archiveItems, body.unarchiveItems].filter(Boolean).length;

  if (actionFlags > 1) {
    return NextResponse.json({ error: "Nur eine Bulk-Aktion gleichzeitig erlaubt" }, { status: 400 });
  }

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const items = await prisma.item.findMany({ where: { id: { in: itemIds } } });

  if (allowedLocationIds) {
    const forbidden = items.some((item) => item.storageLocationId && !allowedLocationIds.includes(item.storageLocationId));
    if (forbidden) return NextResponse.json({ error: "Forbidden by storage scope" }, { status: 403 });
  }

  const previewCodes: Array<{ itemId: string; oldCode: string; newCode: string }> = [];

  if (body.categoryId && body.typeId) {
    const preview = await previewBulkLabelCodes(body.categoryId, body.typeId, items.length);
    for (let idx = 0; idx < items.length; idx += 1) {
      previewCodes.push({ itemId: items[idx].id, oldCode: items[idx].labelCode, newCode: preview[idx] });
    }
  }

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      count: items.length,
      previewCodes
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (body.deleteItems) {
          const deletedItem = await tx.item.update({
            where: { id: item.id },
            data: { deletedAt: new Date() }
          });

          await auditLog(
            {
              userId: auth.user!.id,
              action: "ITEM_SOFT_DELETE",
              entity: "Item",
              entityId: item.id,
              before: item,
              after: deletedItem
            },
            tx
          );
          continue;
        }

        if (body.archiveItems) {
          const archivedItem = await tx.item.update({
            where: { id: item.id },
            data: { isArchived: true }
          });

          await auditLog(
            {
              userId: auth.user!.id,
              action: "ITEM_ARCHIVE",
              entity: "Item",
              entityId: item.id,
              before: item,
              after: archivedItem
            },
            tx
          );
          continue;
        }

        if (body.unarchiveItems) {
          const restoredItem = await tx.item.update({
            where: { id: item.id },
            data: { isArchived: false }
          });

          await auditLog(
            {
              userId: auth.user!.id,
              action: "ITEM_UNARCHIVE",
              entity: "Item",
              entityId: item.id,
              before: item,
              after: restoredItem
            },
            tx
          );
          continue;
        }

        const codeRow = previewCodes.find((row) => row.itemId === item.id);
        let labelCode: string | undefined;
        if (codeRow && body.categoryId && body.typeId) {
          labelCode = await assignNextLabelCode(body.categoryId, body.typeId, tx);
        }

        const nextUnit = body.unit || item.unit;
        const unitChanged = nextUnit !== item.unit;

        if (unitChanged) {
          const [movementCount, reservationCount] = await Promise.all([
            tx.stockMovement.count({ where: { itemId: item.id } }),
            tx.reservation.count({ where: { itemId: item.id } })
          ]);
          if (movementCount > 0 || reservationCount > 0) {
            throw new Error("UNIT_CHANGE_BLOCKED");
          }
        }

        let nextStock: number | undefined;
        let nextMinStock: number | null | undefined;

        if (unitChanged) {
          nextStock = toStoredQuantity(nextUnit, serializeStoredQuantity(item.unit, item.stock), {
            field: "Bestand",
            allowNegative: false
          })!;
        }

        if (body.minStock !== undefined || unitChanged) {
          nextMinStock = toStoredQuantity(
            nextUnit,
            body.minStock !== undefined ? body.minStock : serializeStoredQuantity(item.unit, item.minStock),
            {
              field: "Mindestbestand",
              allowNegative: false,
              nullable: true
            }
          );
        }

        await tx.item.update({
          where: { id: item.id },
          data: {
            categoryId: body.categoryId || undefined,
            typeId: body.typeId || undefined,
            ...(nextStock !== undefined ? { stock: nextStock } : {}),
            minStock: nextMinStock === undefined ? undefined : nextMinStock,
            unit: body.unit || undefined,
            labelCode
          }
        });

        if (body.setTagIds) {
          await tx.itemTag.deleteMany({ where: { itemId: item.id } });

          if (body.setTagIds.length) {
            await tx.itemTag.createMany({
              data: body.setTagIds.map((tagId) => ({ itemId: item.id, tagId }))
            });
          }
        } else {
          if (body.addTagIds?.length) {
            for (const tagId of body.addTagIds) {
              await tx.itemTag.upsert({
                where: { itemId_tagId: { itemId: item.id, tagId } },
                update: {},
                create: { itemId: item.id, tagId }
              });
            }
          }

          if (body.removeTagIds?.length) {
            await tx.itemTag.deleteMany({ where: { itemId: item.id, tagId: { in: body.removeTagIds } } });
          }
        }
      }
    });
  } catch (error) {
    if (error instanceof QuantityValidationError) {
      return NextResponse.json({ error: error.message, field: error.field || null }, { status: 400 });
    }
    if ((error as Error).message === "UNIT_CHANGE_BLOCKED") {
      return NextResponse.json(
        { error: "Einheitenwechsel ist nur moeglich, solange noch keine Bewegungen oder Reservierungen existieren" },
        { status: 400 }
      );
    }
    throw error;
  }

  return NextResponse.json({ dryRun: false, count: items.length, previewCodes });
}
