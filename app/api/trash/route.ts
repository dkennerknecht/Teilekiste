import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const items = await prisma.item.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } });
  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { itemId } = await req.json();
  const restored = await prisma.item.update({ where: { id: itemId }, data: { deletedAt: null } });
  return NextResponse.json(restored);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { itemId } = await req.json();
  await prisma.item.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
