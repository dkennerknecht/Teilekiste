import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess } from "@/lib/api";
import { namePayloadSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, namePayloadSchema);
  if ("error" in parsed) return parsed.error;
  const { name } = parsed.data as ReturnType<typeof namePayloadSchema.parse>;

  const existing = await prisma.tag.findUnique({ where: { name } });
  if (existing) return NextResponse.json(existing);

  const created = await prisma.tag.create({ data: { name } });
  return NextResponse.json(created, { status: 201 });
}
