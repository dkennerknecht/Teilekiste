import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { idPayloadSchema, storageLocationCreateSchema, storageLocationUpdateSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.storageLocation.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, storageLocationCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { name, code } = parsed.data as ReturnType<typeof storageLocationCreateSchema.parse>;
  const location = await prisma.storageLocation.create({ data: { name, code } });
  return NextResponse.json(location, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, storageLocationUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { id, name, code } = parsed.data as ReturnType<typeof storageLocationUpdateSchema.parse>;
  const updated = await prisma.storageLocation.update({
    where: { id },
    data: { name, code: code || null }
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, idPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { id } = parsed.data as ReturnType<typeof idPayloadSchema.parse>;
  await prisma.storageLocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
