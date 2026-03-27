import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { customFieldCreateSchema, customFieldUpdateSchema, idPayloadSchema } from "@/lib/validation";
import { createUniqueCustomFieldKey, findConflictingCustomField } from "@/lib/custom-fields";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  return NextResponse.json(
    await prisma.customField.findMany({
      include: {
        category: true,
        labelType: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: [{ name: "asc" }, { key: "asc" }]
    })
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, customFieldCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof customFieldCreateSchema.parse>;
  const categoryId = body.categoryId || null;
  const typeId = body.typeId || null;
  const conflict = await findConflictingCustomField(prisma, { name: body.name, categoryId, typeId });
  if (conflict) {
    return NextResponse.json({ error: "Ein Custom Field mit diesem Namen und Scope existiert bereits." }, { status: 409 });
  }
  const key = body.key?.trim() || (await createUniqueCustomFieldKey(prisma, body.name));
  const customField = await prisma.customField.create({
    data: {
      name: body.name,
      key,
      type: body.type,
      unit: body.unit?.trim() || null,
      required: !!body.required,
      options: body.options ? JSON.stringify(body.options) : null,
      categoryId,
      typeId
    },
    include: {
      category: true,
      labelType: {
        select: { id: true, name: true, code: true }
      }
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
  const existing = await prisma.customField.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const categoryId = body.categoryId === undefined ? existing.categoryId : body.categoryId || null;
  const typeId = body.typeId === undefined ? existing.typeId : body.typeId || null;
  const nextName = body.name ?? existing.name;
  const conflict = await findConflictingCustomField(prisma, {
    name: nextName,
    categoryId,
    typeId,
    excludeId: body.id
  });
  if (conflict) {
    return NextResponse.json({ error: "Ein Custom Field mit diesem Namen und Scope existiert bereits." }, { status: 409 });
  }
  const updated = await prisma.customField.update({
    where: { id: body.id },
    data: {
      name: body.name,
      key: body.key?.trim() || undefined,
      type: body.type,
      unit: body.unit === undefined ? undefined : body.unit?.trim() || null,
      required: body.required !== undefined ? !!body.required : undefined,
      options: body.options !== undefined ? (body.options ? JSON.stringify(body.options) : null) : undefined,
      categoryId: body.categoryId === undefined ? undefined : categoryId,
      typeId: body.typeId === undefined ? undefined : typeId,
      isActive: body.isActive !== undefined ? !!body.isActive : undefined
    },
    include: {
      category: true,
      labelType: {
        select: { id: true, name: true, code: true }
      }
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
