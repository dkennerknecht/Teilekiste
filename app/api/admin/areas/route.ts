import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { areaCreateSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.area.findMany({ include: { types: true }, orderBy: { code: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, areaCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { code, name, active } = parsed.data as ReturnType<typeof areaCreateSchema.parse>;
  const area = await prisma.area.create({ data: { code, name, active: active !== false } });
  return NextResponse.json(area, { status: 201 });
}
