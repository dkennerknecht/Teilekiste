import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.tag.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { name } = await req.json();
  const tag = await prisma.tag.create({ data: { name } });
  return NextResponse.json(tag, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id, name } = await req.json();
  if (!id || !name) return NextResponse.json({ error: "id and name required" }, { status: 400 });
  const updated = await prisma.tag.update({ where: { id }, data: { name } });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
