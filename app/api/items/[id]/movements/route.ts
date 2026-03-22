import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { stockMovementSchema } from "@/lib/validation";
import { auditLog } from "@/lib/audit";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess();
  if (auth.error) return auth.error;

  const parsed = stockMovementSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = await prisma.item.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        itemId: item.id,
        delta: parsed.data.delta,
        reason: parsed.data.reason,
        note: parsed.data.note,
        userId: auth.user!.id
      }
    });

    const newItem = await tx.item.update({
      where: { id: item.id },
      data: { stock: { increment: parsed.data.delta } }
    });

    return { movement, item: newItem };
  });

  await auditLog({
    userId: auth.user!.id,
    action: "STOCK_MOVEMENT",
    entity: "Item",
    entityId: item.id,
    before: { stock: item.stock },
    after: { stock: updated.item.stock, delta: parsed.data.delta }
  });

  return NextResponse.json(updated);
}
