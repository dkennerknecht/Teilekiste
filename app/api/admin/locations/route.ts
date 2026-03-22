import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.storageLocation.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { name, code } = await req.json();
  const location = await prisma.storageLocation.create({ data: { name, code } });
  return NextResponse.json(location, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id, name, code } = await req.json();
  if (!id || !name) return NextResponse.json({ error: "id and name required" }, { status: 400 });
  const updated = await prisma.storageLocation.update({
    where: { id },
    data: { name, code: code || null }
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.storageLocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
