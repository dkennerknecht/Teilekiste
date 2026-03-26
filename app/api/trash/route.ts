import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { itemIdPayloadSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const items = await prisma.item.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } });
  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, itemIdPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { itemId } = parsed.data as ReturnType<typeof itemIdPayloadSchema.parse>;
  const restored = await prisma.item.update({ where: { id: itemId }, data: { deletedAt: null } });
  return NextResponse.json(restored);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, itemIdPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { itemId } = parsed.data as ReturnType<typeof itemIdPayloadSchema.parse>;
  await prisma.item.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
