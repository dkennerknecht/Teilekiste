import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import archiver from "archiver";
import { createWriteStream } from "node:fs";
import AdmZip from "adm-zip";
import { env } from "@/lib/env";
import { ensureDir } from "@/lib/fs";

export type BackupManifest = {
  createdAt: string;
  exportJsonSha256: string;
  hasUploads: boolean;
  hasAttachments: boolean;
  itemCount: number;
  bomCount: number;
  auditCount: number;
};

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function enforceBackupRetention() {
  const entries = (await fs.readdir(env.BACKUP_DIR))
    .filter((name) => name.endsWith(".zip"))
    .sort();
  const retention = Math.max(1, env.BACKUP_RETENTION_COUNT);
  const toDelete = entries.slice(0, Math.max(0, entries.length - retention));

  await Promise.all(
    toDelete.map(async (name) => {
      await fs.rm(path.join(env.BACKUP_DIR, name), { force: true });
    })
  );

  return toDelete;
}

export async function createBackupZip(exportJson: any) {
  await ensureDir(env.BACKUP_DIR);
  const name = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  const target = path.join(env.BACKUP_DIR, name);
  const output = createWriteStream(target);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const exportBuffer = Buffer.from(JSON.stringify(exportJson, null, 2));
  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    exportJsonSha256: sha256(exportBuffer),
    hasUploads: await pathExists(env.UPLOAD_DIR),
    hasAttachments: await pathExists(env.ATTACHMENT_DIR),
    itemCount: Array.isArray(exportJson?.items) ? exportJson.items.length : 0,
    bomCount: Array.isArray(exportJson?.boms) ? exportJson.boms.length : 0,
    auditCount: Array.isArray(exportJson?.auditLogs) ? exportJson.auditLogs.length : 0
  };

  archive.pipe(output);
  archive.append(exportBuffer, { name: "export.json" });
  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

  if (manifest.hasUploads) {
    archive.directory(env.UPLOAD_DIR, "uploads");
  }

  if (manifest.hasAttachments) {
    archive.directory(env.ATTACHMENT_DIR, "attachments");
  }

  await archive.finalize();
  await new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
  });

  const zipSha256 = sha256(await fs.readFile(target));
  const deletedBackups = await enforceBackupRetention();

  return {
    backupFile: target,
    fileName: name,
    zipSha256,
    manifest,
    deletedBackups
  };
}

export async function inspectBackupZip(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  const exportEntry = zip.getEntry("export.json");
  if (!exportEntry) {
    throw new Error("export.json fehlt");
  }

  const manifestEntry = zip.getEntry("manifest.json");
  const exportBuffer = exportEntry.getData();
  const exportJsonSha256 = sha256(exportBuffer);
  const payload = JSON.parse(exportBuffer.toString("utf8"));
  const manifest = manifestEntry ? (JSON.parse(manifestEntry.getData().toString("utf8")) as BackupManifest) : null;

  return {
    payload,
    manifest,
    exportJsonSha256,
    checksumVerified: manifest ? manifest.exportJsonSha256 === exportJsonSha256 : false,
    summary: {
      items: Array.isArray(payload?.items) ? payload.items.length : 0,
      boms: Array.isArray(payload?.boms) ? payload.boms.length : 0,
      auditLogs: Array.isArray(payload?.auditLogs) ? payload.auditLogs.length : 0,
      users: Array.isArray(payload?.users) ? payload.users.length : 0,
      categories: Array.isArray(payload?.categories) ? payload.categories.length : 0,
      locations: Array.isArray(payload?.locations) ? payload.locations.length : 0
    }
  };
}
