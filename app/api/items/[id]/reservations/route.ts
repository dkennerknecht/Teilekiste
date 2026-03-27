import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { auditLog } from "@/lib/audit";
import { reservationSchema } from "@/lib/validation";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { canReserveQty } from "@/lib/stock";
import { parseJson } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, reservationSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof reservationSchema.parse>;

  const item = await prisma.item.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const reservedQtyResult = await prisma.reservation.aggregate({
    where: { itemId: params.id },
    _sum: { reservedQty: true }
  });
  const reservedQty = reservedQtyResult._sum.reservedQty || 0;

  if (!canReserveQty(item.stock, reservedQty, body.reservedQty)) {
    return NextResponse.json({ error: "Nicht genug verfuegbarer Bestand fuer diese Reservierung" }, { status: 400 });
  }

  const reservation = await prisma.$transaction(async (tx) => {
    const createdReservation = await tx.reservation.create({
      data: {
        itemId: params.id,
        reservedQty: body.reservedQty,
        reservedFor: body.reservedFor,
        note: body.note || null,
        userId: auth.user!.id
      }
    });

    await auditLog(
      {
        userId: auth.user!.id,
        action: "RESERVATION_CREATE",
        entity: "Item",
        entityId: params.id,
        after: {
          reservationId: createdReservation.id,
          reservedQty: createdReservation.reservedQty,
          reservedFor: createdReservation.reservedFor,
          note: createdReservation.note
        }
      },
      tx
    );

    return createdReservation;
  });

  return NextResponse.json(reservation, { status: 201 });
}
