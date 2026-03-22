import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.customField.findMany({ include: { category: true }, orderBy: { name: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await req.json();
  const customField = await prisma.customField.create({
    data: {
      name: body.name,
      key: body.key,
      type: body.type,
      required: !!body.required,
      options: body.options ? JSON.stringify(body.options) : null,
      categoryId: body.categoryId || null
    }
  });
  return NextResponse.json(customField, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updated = await prisma.customField.update({
    where: { id: body.id },
    data: {
      name: body.name,
      key: body.key,
      type: body.type,
      required: body.required !== undefined ? !!body.required : undefined,
      options: body.options !== undefined ? (body.options ? JSON.stringify(body.options) : null) : undefined,
      categoryId: body.categoryId === undefined ? undefined : body.categoryId || null,
      isActive: body.isActive !== undefined ? !!body.isActive : undefined
    }
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.customField.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
