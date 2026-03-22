import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { adminUserSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const users = await prisma.user.findMany({ include: { allowedScopes: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(users.map((u) => ({ ...u, passwordHash: undefined })));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, adminUserSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof adminUserSchema.parse>;
  const passwordHash = await bcrypt.hash(body.password || "changeme123", 10);

  const created = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role || "READ",
      isActive: body.isActive !== false,
      allowedScopes: {
        create: (body.allowedLocationIds || []).map((storageLocationId: string) => ({ storageLocationId }))
      }
    }
  });

  return NextResponse.json({ ...created, passwordHash: undefined }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, unknown> = {
    name: body.name,
    email: body.email,
    role: body.role,
    isActive: body.isActive
  };

  if (body.password) {
    data.passwordHash = await bcrypt.hash(String(body.password), 10);
  }

  const updated = await prisma.user.update({
    where: { id: body.id },
    data
  });

  if (Array.isArray(body.allowedLocationIds)) {
    await prisma.userLocation.deleteMany({ where: { userId: body.id } });
    if (body.allowedLocationIds.length) {
      await prisma.userLocation.createMany({
        data: body.allowedLocationIds.map((storageLocationId: string) => ({ userId: body.id, storageLocationId }))
      });
    }
  }

  return NextResponse.json({ ...updated, passwordHash: undefined });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
