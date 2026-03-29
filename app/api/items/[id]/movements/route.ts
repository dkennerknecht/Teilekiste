import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { stockMovementSchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { canSetStock } from "@/lib/stock";
import { QuantityValidationError, serializeStoredQuantity, toStoredQuantity } from "@/lib/quantity";
import { parseJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, stockMovementSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof stockMovementSchema.parse>;

  const item = await prisma.item.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const reservedQtyResult = await prisma.reservation.aggregate({
    where: { itemId: item.id },
    _sum: { reservedQty: true }
  });
  const reservedQty = reservedQtyResult._sum.reservedQty || 0;
  let storedDelta: number;
  try {
    storedDelta = toStoredQuantity(item.unit, body.delta, {
      field: "Buchungsmenge",
      allowNegative: true,
      allowZero: false
    })!;
  } catch (error) {
    if (error instanceof QuantityValidationError) {
      return NextResponse.json({ error: error.message, field: error.field || null }, { status: 400 });
    }
    throw error;
  }
  const nextStock = item.stock + storedDelta;

  if (!canSetStock(nextStock, reservedQty)) {
    return NextResponse.json({ error: "Bestand darf nicht unter die reservierte Menge fallen" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        itemId: item.id,
        delta: storedDelta,
        reason: body.reason,
        note: body.note,
        userId: auth.user!.id
      }
    });

    const newItem = await tx.item.update({
      where: { id: item.id },
      data: { stock: { increment: storedDelta } }
    });

    return { movement, item: newItem };
  });

  await auditLog({
    userId: auth.user!.id,
    action: "STOCK_MOVEMENT",
    entity: "Item",
    entityId: item.id,
    before: { stock: item.stock, unit: item.unit },
    after: { stock: updated.item.stock, delta: storedDelta, unit: item.unit }
  });

  return NextResponse.json({
    movement: {
      ...updated.movement,
      delta: serializeStoredQuantity(item.unit, updated.movement.delta)
    },
    item: {
      ...updated.item,
      stock: serializeStoredQuantity(item.unit, updated.item.stock),
      minStock: serializeStoredQuantity(item.unit, updated.item.minStock)
    }
  });
}
