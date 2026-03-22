import fs from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { env } from "@/lib/env";
import { ensureDir } from "@/lib/fs";

export async function createBackupZip(exportJson: unknown) {
  await ensureDir(env.BACKUP_DIR);
  const name = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  const target = path.join(env.BACKUP_DIR, name);
  const output = createWriteStream(target);
  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.pipe(output);
  archive.append(JSON.stringify(exportJson, null, 2), { name: "export.json" });

  try {
    await fs.access(env.UPLOAD_DIR);
    archive.directory(env.UPLOAD_DIR, "uploads");
  } catch {}

  try {
    await fs.access(env.ATTACHMENT_DIR);
    archive.directory(env.ATTACHMENT_DIR, "attachments");
  } catch {}

  await archive.finalize();
  await new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
  });

  return target;
}
