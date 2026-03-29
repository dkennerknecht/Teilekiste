import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { buildBackupPayload } from "@/lib/backup-payload";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { serializeStoredQuantity } from "@/lib/quantity";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const payload = await buildBackupPayload({ allowedLocationIds });

  const exportPayload = {
    ...payload,
    items: (payload.items || []).map((item) => ({
      ...item,
      stock: serializeStoredQuantity(item.unit, item.stock),
      minStock: serializeStoredQuantity(item.unit, item.minStock),
      movements: (item.movements || []).map((movement) => ({
        ...movement,
        delta: serializeStoredQuantity(item.unit, movement.delta)
      })),
      reservations: (item.reservations || []).map((reservation) => ({
        ...reservation,
        reservedQty: serializeStoredQuantity(item.unit, reservation.reservedQty)
      }))
    }))
  };

  return NextResponse.json(exportPayload);
}
