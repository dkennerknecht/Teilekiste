import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import AdmZip from "adm-zip";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { restoreBackupData, type BackupPayload } from "@/lib/backup-restore";
import { backupRestoreSchema } from "@/lib/validation";
import { badRequest } from "@/lib/http";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get("file");
  const parsed = backupRestoreSchema.safeParse({ strategy: String(form.get("strategy") || "merge") });
  if (!parsed.success) return badRequest("Invalid restore strategy");
  const strategy = parsed.data.strategy;

  if (!(file instanceof File)) return badRequest("Backup ZIP fehlt");
  if (file.size > 500 * 1024 * 1024) return badRequest("Backup ZIP zu gross (max 500MB)");

  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = new AdmZip(buffer);
  const exportEntry = zip.getEntry("export.json");
  if (!exportEntry) return badRequest("export.json fehlt");
  let payload: BackupPayload;
  try {
    payload = JSON.parse(exportEntry.getData().toString("utf8"));
  } catch {
    return badRequest("export.json ungueltig");
  }

  if (strategy === "overwrite") {
    await prisma.$transaction([
      prisma.favorite.deleteMany(),
      prisma.recentView.deleteMany(),
      prisma.itemTag.deleteMany(),
      prisma.itemCustomFieldValue.deleteMany(),
      prisma.reservation.deleteMany(),
      prisma.stockMovement.deleteMany(),
      prisma.itemImage.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.item.deleteMany(),
      prisma.customField.deleteMany(),
      prisma.tag.deleteMany(),
      prisma.category.deleteMany(),
      prisma.storageLocation.deleteMany()
    ]);
  }

  const result = await restoreBackupData({
    payload,
    strategy,
    fallbackUserId: auth.user.id
  });

  const restoreTmp = await fs.mkdtemp(path.join(os.tmpdir(), "teilekiste-restore-"));
  try {
    zip.extractAllTo(restoreTmp, true);
    await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
    await fs.mkdir(env.ATTACHMENT_DIR, { recursive: true });
    await fs.cp(path.join(restoreTmp, "uploads"), env.UPLOAD_DIR, { recursive: true, force: true }).catch(() => null);
    await fs.cp(path.join(restoreTmp, "attachments"), env.ATTACHMENT_DIR, { recursive: true, force: true }).catch(() => null);
  } finally {
    await fs.rm(restoreTmp, { recursive: true, force: true }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    strategy,
    restoredCategories: result.restoredCategories,
    restoredItems: result.restoredItems,
    restoredUsers: result.restoredUsers,
    placeholderUsers: result.placeholderUsers,
    conflicts: result.conflicts
  });
}
