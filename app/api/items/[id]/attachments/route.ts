import path from "node:path";
import { randomUUID } from "node:crypto";
import mime from "mime-types";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { saveFile, sanitizeFileName } from "@/lib/fs";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { resolveAllowedLocationIds } from "@/lib/permissions";

const allowed = new Set([
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/octet-stream",
  "model/stl",
  "model/step",
  "application/vnd.ms-pki.stl"
]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess();
  if (auth.error) return auth.error;

  const item = await prisma.item.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  if (file.size > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) return NextResponse.json({ error: "File too large" }, { status: 400 });
  if (!allowed.has(file.type) && file.type !== "") {
    return NextResponse.json({ error: "Invalid MIME" }, { status: 400 });
  }

  const ext = mime.extension(file.type || "application/octet-stream") || "bin";
  const baseName = `${randomUUID()}-${sanitizeFileName(file.name || "attachment")}.${ext}`;
  const target = path.join(env.ATTACHMENT_DIR, params.id, baseName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await saveFile(buffer, target);

  const created = await prisma.attachment.create({
    data: {
      itemId: params.id,
      path: target,
      mime: file.type || "application/octet-stream",
      size: file.size,
      kind: (file.type || "").includes("pdf") ? "PDF" : "FILE"
    }
  });

  return NextResponse.json(created, { status: 201 });
}
