import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const [items, lowStock, users, locations] = await Promise.all([
    prisma.item.count({ where: { deletedAt: null } }),
    prisma.item.findMany({ where: { deletedAt: null, minStock: { not: null } }, select: { stock: true, minStock: true } }).then((rows) => rows.filter((r) => r.minStock !== null && r.stock <= r.minStock).length),
    prisma.user.count(),
    prisma.storageLocation.count()
  ]);

  let latestBackup: string | null = null;
  try {
    const files = await fs.readdir(env.BACKUP_DIR);
    const backups = files.filter((name) => name.endsWith(".zip")).sort();
    if (backups.length) latestBackup = path.join(env.BACKUP_DIR, backups[backups.length - 1]);
  } catch {}

  return NextResponse.json({ items, lowStock, users, locations, latestBackup });
}
