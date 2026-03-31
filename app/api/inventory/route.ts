import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { inventoryUpdateSchema } from "@/lib/validation";
import { canSetStock } from "@/lib/stock";
import { QuantityValidationError, serializeStoredQuantity, toStoredQuantity } from "@/lib/quantity";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const locationId = req.nextUrl.searchParams.get("storageLocationId") || undefined;
  const storageArea = req.nextUrl.searchParams.get("storageArea") || undefined;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const where = {
    deletedAt: null,
    isArchived: false,
    storageLocationId: allowedLocationIds
      ? { in: locationId ? [locationId].filter((id) => allowedLocationIds.includes(id)) : allowedLocationIds.length ? allowedLocationIds : ["__none__"] }
      : locationId,
    storageArea: storageArea ? { contains: storageArea } : undefined
  };

  const items = await prisma.item.findMany({ where, orderBy: [{ storageArea: "asc" }, { binSlot: "asc" }, { labelCode: "asc" }] });
  return NextResponse.json(
    items.map((item) => ({
      ...item,
      stock: serializeStoredQuantity(item.unit, item.stock),
      minStock: serializeStoredQuantity(item.unit, item.minStock)
    }))
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, inventoryUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof inventoryUpdateSchema.parse>;
  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const applied = [] as Array<{ itemId: string; unit: string; before: number; after: number; delta: number }>;

      for (const update of body.updates || []) {
        const item = await tx.item.findUnique({ where: { id: update.itemId } });
        if (!item) continue;
        if (item.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
          throw new Error("FORBIDDEN");
        }
        const reservedQtyResult = await tx.reservation.aggregate({
          where: { itemId: item.id },
          _sum: { reservedQty: true }
        });
        const reservedQty = reservedQtyResult._sum.reservedQty || 0;
        const countedStock = toStoredQuantity(item.unit, update.countedStock, {
          field: "Ist-Bestand",
          allowNegative: false
        })!;
        if (!canSetStock(countedStock, reservedQty)) {
          throw new Error("RESERVED_BELOW_STOCK");
        }
        const delta = countedStock - item.stock;
        if (delta === 0) continue;

        const newItem = await tx.item.update({
          where: { id: item.id },
          data: { stock: countedStock }
        });

        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            delta,
            reason: "INVENTORY",
            note: update.note || "Inventurabgleich",
            userId: auth.user!.id
          }
        });

        applied.push({
          itemId: item.id,
          unit: item.unit,
          before: serializeStoredQuantity(item.unit, item.stock) ?? 0,
          after: serializeStoredQuantity(item.unit, newItem.stock) ?? 0,
          delta: serializeStoredQuantity(item.unit, delta) ?? 0
        });
      }

      return applied;
    });

    return NextResponse.json({ applied: result });
  } catch (error) {
    if (error instanceof QuantityValidationError) {
      return NextResponse.json({ error: error.message, field: error.field || null }, { status: 400 });
    }
    if ((error as Error).message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if ((error as Error).message === "RESERVED_BELOW_STOCK") {
      return NextResponse.json({ error: "Bestand darf nicht unter die reservierte Menge fallen" }, { status: 400 });
    }
    throw error;
  }
}
