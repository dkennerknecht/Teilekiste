import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  await prisma.apiToken.update({
    where: { id: params.id },
    data: { isActive: false }
  });

  return NextResponse.json({ ok: true });
}
