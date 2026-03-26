import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { labelTypeCreateSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.labelType.findMany({ include: { area: true }, orderBy: { code: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, labelTypeCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { areaId, code, name, active } = parsed.data as ReturnType<typeof labelTypeCreateSchema.parse>;
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
