import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { itemId } = await req.json();
  await prisma.favorite.upsert({
    where: { userId_itemId: { userId: auth.user!.id, itemId } },
    update: {},
    create: { userId: auth.user!.id, itemId }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { itemId } = await req.json();
  await prisma.favorite.delete({ where: { userId_itemId: { userId: auth.user!.id, itemId } } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
