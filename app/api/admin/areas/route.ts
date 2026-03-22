import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.area.findMany({ include: { types: true }, orderBy: { code: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { code, name, active } = await req.json();
  const area = await prisma.area.create({ data: { code, name, active: active !== false } });
  return NextResponse.json(area, { status: 201 });
}
