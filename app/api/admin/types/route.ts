import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { idPayloadSchema, labelTypeCreateSchema, labelTypeUpdateSchema } from "@/lib/validation";
import { syncLabelCatalog } from "@/lib/label-catalog";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { areaId } = await syncLabelCatalog(prisma);
  return NextResponse.json(await prisma.labelType.findMany({ where: { areaId }, orderBy: { code: "asc" } }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, labelTypeCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { areaId } = await syncLabelCatalog(prisma);
  const { code, name, active } = parsed.data as ReturnType<typeof labelTypeCreateSchema.parse>;
  const type = await prisma.labelType.create({
    data: {
      areaId,
      code: code.toUpperCase(),
      name,
      active: active !== false
    }
  });

  return NextResponse.json(type, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, labelTypeUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { id, code, name, active } = parsed.data as ReturnType<typeof labelTypeUpdateSchema.parse>;
  const updated = await prisma.labelType.update({
    where: { id },
    data: {
      code: code.toUpperCase(),
      name,
      active: active !== undefined ? active !== false : undefined
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
  await prisma.labelType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
