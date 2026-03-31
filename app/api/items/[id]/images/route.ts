import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import mime from "mime-types";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { saveFile } from "@/lib/fs";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { orderedImageIdsSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function collectUploadFiles(formData: FormData) {
  const entries = formData.getAll("files");
  if (entries.length > 0) {
    return entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  }

  const single = formData.get("file");
  return single instanceof File && single.size > 0 ? [single] : [];
}

async function checkItemAccess(itemId: string, user: { id: string; role: string }) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const allowedLocationIds = await resolveAllowedLocationIds(user as never);
  if (item.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(item.storageLocationId)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { item };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const access = await checkItemAccess(params.id, auth.user!);
  if (access.error) return access.error;

  const formData = await req.formData();
  const files = collectUploadFiles(formData);
  const caption = String(formData.get("caption") || "");
  if (!files.length) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  for (const file of files) {
    if (!allowed.has(file.type)) return NextResponse.json({ error: "Invalid MIME" }, { status: 400 });
    if (file.size > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }
  }

  const preparedFiles = await Promise.all(
    files.map(async (file) => {
      const ext = mime.extension(file.type) || "bin";
      const baseName = `${randomUUID()}.${ext}`;
      const target = path.join(env.UPLOAD_DIR, params.id, baseName);
      const thumb = path.join(env.UPLOAD_DIR, params.id, `thumb-${baseName}.jpg`);
      const buffer = Buffer.from(await file.arrayBuffer());
      return {
        file,
        buffer,
        target,
        thumb
      };
    })
  );

  for (const prepared of preparedFiles) {
    await saveFile(prepared.buffer, prepared.target);
    await sharp(prepared.buffer).resize(480).jpeg({ quality: 80 }).toFile(prepared.thumb);
  }

  const created = await prisma.$transaction(async (tx) => {
    const images = await tx.itemImage.findMany({
      where: { itemId: params.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true }
    });

    const sharedCaption = files.length === 1 ? caption || null : null;
    const createdImages = [];

    for (let index = 0; index < preparedFiles.length; index += 1) {
      const prepared = preparedFiles[index];
      createdImages.push(
        await tx.itemImage.create({
          data: {
            itemId: params.id,
            path: prepared.target,
            thumbPath: prepared.thumb,
            isPrimary: images.length === 0 && index === 0,
            sortOrder: images.length + index,
            mime: prepared.file.type,
            size: prepared.file.size,
            caption: sharedCaption
          }
        })
      );
    }

    return createdImages;
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const access = await checkItemAccess(params.id, auth.user!);
  if (access.error) return access.error;

  const parsed = await parseJson<unknown>(req, orderedImageIdsSchema);
  if ("error" in parsed) return parsed.error;
  const { orderedImageIds } = parsed.data as ReturnType<typeof orderedImageIdsSchema.parse>;

  const existing = await prisma.itemImage.findMany({
    where: { itemId: params.id },
    select: { id: true }
  });

  if (existing.length !== orderedImageIds.length) {
    return NextResponse.json({ error: "order must include all images" }, { status: 400 });
  }

  const existingIds = new Set(existing.map((image) => image.id));
  if (!orderedImageIds.every((id: string) => existingIds.has(id))) {
    return NextResponse.json({ error: "invalid image id in order" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedImageIds.map((id, index) =>
      prisma.itemImage.update({
        where: { id },
        data: { sortOrder: index, isPrimary: index === 0 }
      })
    )
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const access = await checkItemAccess(params.id, auth.user!);
  if (access.error) return access.error;

  const imageId = req.nextUrl.searchParams.get("imageId");
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });

  const image = await prisma.itemImage.findFirst({ where: { id: imageId, itemId: params.id } });
  if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.itemImage.delete({ where: { id: image.id } });

    const remaining = await tx.itemImage.findMany({
      where: { itemId: params.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true }
    });

    for (let i = 0; i < remaining.length; i += 1) {
      await tx.itemImage.update({
        where: { id: remaining[i].id },
        data: { sortOrder: i, isPrimary: i === 0 }
      });
    }
  });

  await Promise.all([
    fs.unlink(image.path).catch(() => undefined),
    image.thumbPath ? fs.unlink(image.thumbPath).catch(() => undefined) : Promise.resolve()
  ]);

  return NextResponse.json({ ok: true });
}
