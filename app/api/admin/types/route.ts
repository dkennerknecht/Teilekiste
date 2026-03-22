import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.labelType.findMany({ include: { area: true }, orderBy: { code: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { areaId, code, name, active } = await req.json();
  const type = await prisma.labelType.create({
    data: {
      areaId,
      code,
      name,
      active: active !== false
    }
  });

  await prisma.sequenceCounter.upsert({
    where: { areaId_typeId: { areaId, typeId: type.id } },
    update: {},
    create: { areaId, typeId: type.id, nextNumber: 1 }
  });

  return NextResponse.json(type, { status: 201 });
}
