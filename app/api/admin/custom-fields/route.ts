import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { customFieldCreateSchema, customFieldUpdateSchema, idPayloadSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  return NextResponse.json(await prisma.customField.findMany({ include: { category: true }, orderBy: { name: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, customFieldCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof customFieldCreateSchema.parse>;
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
  const parsed = await parseJson<unknown>(req, customFieldUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof customFieldUpdateSchema.parse>;
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
  const parsed = await parseJson<unknown>(req, idPayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { id } = parsed.data as ReturnType<typeof idPayloadSchema.parse>;
  await prisma.customField.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
