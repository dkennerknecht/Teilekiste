import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess();
  if (auth.error) return auth.error;

  await prisma.reservation.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
