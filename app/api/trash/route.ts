import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { itemIdPayloadSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";
import { canRestoreDeletedItem, purgeExpiredDeletedItems } from "@/lib/trash";
import { TRASH_RETENTION_DAYS } from "@/lib/trash-policy";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  await purgeExpiredDeletedItems(true);
  const items = await prisma.item.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } });
  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  await purgeExpiredDeletedItems(true);
  const parsed = await parseJson<unknown>(req, itemIdPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { itemId } = parsed.data as ReturnType<typeof itemIdPayloadSchema.parse>;
  const existing = await prisma.item.findUnique({ where: { id: itemId } });
  if (!existing || !existing.deletedAt) {
    return NextResponse.json({ error: "Nicht im Papierkorb gefunden" }, { status: 404 });
  }
  if (!canRestoreDeletedItem(existing.deletedAt)) {
    return NextResponse.json({ error: `Die ${TRASH_RETENTION_DAYS}-Tage-Aufbewahrung ist abgelaufen.` }, { status: 410 });
  }
  const restored = await prisma.item.update({ where: { id: itemId }, data: { deletedAt: null } });
  return NextResponse.json(restored);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  await purgeExpiredDeletedItems(true);
  return NextResponse.json(
    { error: `Items im Papierkorb bleiben ${TRASH_RETENTION_DAYS} Tage wiederherstellbar und werden danach automatisch entfernt.` },
    { status: 405 }
  );
}
