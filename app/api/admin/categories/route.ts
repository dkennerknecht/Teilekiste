import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { categoryCreateSchema, categoryUpdateSchema, idPayloadSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.category.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, categoryCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { name, code } = parsed.data as ReturnType<typeof categoryCreateSchema.parse>;
  const category = await prisma.category.create({ data: { name, code: code.toUpperCase() } });
  return NextResponse.json(category, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, categoryUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { id, name, code } = parsed.data as ReturnType<typeof categoryUpdateSchema.parse>;
  const updated = await prisma.category.update({ where: { id }, data: { name, code: code.toUpperCase() } });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, idPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { id } = parsed.data as ReturnType<typeof idPayloadSchema.parse>;
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
