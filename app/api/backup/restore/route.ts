import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import AdmZip from "adm-zip";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { inspectBackupZip } from "@/lib/backup";
import { previewBackupRestore, restoreBackupData, type BackupPayload } from "@/lib/backup-restore";
import { backupRestoreSchema } from "@/lib/validation";
import { badRequest } from "@/lib/http";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const form = await req.formData();
  const file = form.get("file");
  const parsed = backupRestoreSchema.safeParse({
    strategy: String(form.get("strategy") || "merge"),
    dryRun: String(form.get("dryRun") || "1") !== "0"
  });
  if (!parsed.success) return badRequest("Invalid restore strategy");
  const { strategy, dryRun } = parsed.data;

  if (!(file instanceof File)) return badRequest("Backup ZIP fehlt");
  if (file.size > 500 * 1024 * 1024) return badRequest("Backup ZIP zu gross (max 500MB)");

  const buffer = Buffer.from(await file.arrayBuffer());
  let payload: BackupPayload;
  let manifest: Awaited<ReturnType<typeof inspectBackupZip>>["manifest"] = null;
  let checksumVerified = false;
  try {
    const inspected = await inspectBackupZip(buffer);
    payload = inspected.payload as BackupPayload;
    manifest = inspected.manifest;
    checksumVerified = inspected.checksumVerified;
  } catch (error) {
    return badRequest((error as Error).message || "export.json ungueltig");
  }

  if (manifest && !checksumVerified) {
    return badRequest("Backup-Pruefsumme stimmt nicht");
  }

  if (dryRun) {
    const preview = await previewBackupRestore({ payload, strategy });
    return NextResponse.json({
      ok: true,
      dryRun: true,
      checksumVerified,
      manifest,
      ...preview
    });
  }

  const zip = new AdmZip(buffer);
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
      prisma.billOfMaterial.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.item.deleteMany(),
      prisma.customField.deleteMany(),
      prisma.tag.deleteMany(),
      prisma.sequenceCounter.deleteMany(),
      prisma.labelType.deleteMany(),
      prisma.area.deleteMany(),
      prisma.labelConfig.deleteMany(),
      prisma.userLocation.deleteMany(),
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
    dryRun: false,
    strategy,
    checksumVerified,
    manifest,
    restoredCategories: result.restoredCategories,
    restoredLocations: result.restoredLocations,
    restoredTags: result.restoredTags,
    restoredAreas: result.restoredAreas,
    restoredTypes: result.restoredTypes,
    restoredSequenceCounters: result.restoredSequenceCounters,
    restoredItems: result.restoredItems,
    restoredBomEntries: result.restoredBomEntries,
    restoredAuditLogs: result.restoredAuditLogs,
    restoredUsers: result.restoredUsers,
    restoredUserScopes: result.restoredUserScopes,
    placeholderUsers: result.placeholderUsers,
    conflicts: result.conflicts
  });
}
