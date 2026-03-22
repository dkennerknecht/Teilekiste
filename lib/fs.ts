import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveFile(buffer: Buffer, targetPath: string) {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, buffer);
}

export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}
