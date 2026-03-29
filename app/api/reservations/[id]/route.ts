import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { auditLog } from "@/lib/audit";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: {
      item: {
        select: { id: true, storageLocationId: true, unit: true }
      }
    }
  });
  if (!reservation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(reservation.item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.delete({ where: { id: params.id } });
    await auditLog(
      {
        userId: auth.user!.id,
        action: "RESERVATION_DELETE",
        entity: "Item",
        entityId: reservation.itemId,
        before: {
          reservationId: reservation.id,
          reservedQty: reservation.reservedQty,
          reservedFor: reservation.reservedFor,
          note: reservation.note,
          unit: reservation.item.unit || null
        }
      },
      tx
    );
  });

  return NextResponse.json({ ok: true });
}
