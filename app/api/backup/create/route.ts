import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createBackupZip } from "@/lib/backup";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const exportJson = {
    exportedAt: new Date().toISOString(),
    items: await prisma.item.findMany({
      include: { tags: true, images: true, attachments: true, movements: true, reservations: true, customValues: true }
    }),
    categories: await prisma.category.findMany(),
    tags: await prisma.tag.findMany(),
    locations: await prisma.storageLocation.findMany(),
    customFields: await prisma.customField.findMany(),
    users: await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true }
    })
  };

  const backupFile = await createBackupZip(exportJson);
  return NextResponse.json({ ok: true, backupFile });
}
