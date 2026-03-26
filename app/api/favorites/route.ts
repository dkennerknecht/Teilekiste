import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { itemIdPayloadSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, itemIdPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { itemId } = parsed.data as ReturnType<typeof itemIdPayloadSchema.parse>;
  await prisma.favorite.upsert({
    where: { userId_itemId: { userId: auth.user!.id, itemId } },
    update: {},
    create: { userId: auth.user!.id, itemId }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, itemIdPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { itemId } = parsed.data as ReturnType<typeof itemIdPayloadSchema.parse>;
  await prisma.favorite.delete({ where: { userId_itemId: { userId: auth.user!.id, itemId } } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
