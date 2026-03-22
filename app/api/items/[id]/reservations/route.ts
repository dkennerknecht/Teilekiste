import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { reservationSchema } from "@/lib/validation";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess();
  if (auth.error) return auth.error;

  const parsed = reservationSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = await prisma.item.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const reservation = await prisma.reservation.create({
    data: {
      itemId: params.id,
      reservedQty: parsed.data.reservedQty,
      reservedFor: parsed.data.reservedFor,
      note: parsed.data.note || null,
      userId: auth.user!.id
    }
  });

  return NextResponse.json(reservation, { status: 201 });
}
