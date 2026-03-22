import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const existing = await prisma.tag.findUnique({ where: { name } });
  if (existing) return NextResponse.json(existing);

  const created = await prisma.tag.create({ data: { name } });
  return NextResponse.json(created, { status: 201 });
}
