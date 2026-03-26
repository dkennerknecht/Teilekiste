import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { labelConfigSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const config = await prisma.labelConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  return NextResponse.json(config);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const parsed = await parseJson<unknown>(req, labelConfigSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof labelConfigSchema.parse>;
  const updated = await prisma.labelConfig.update({
    where: { id: "default" },
    data: {
      separator: body.separator,
      digits: Math.max(2, Math.min(6, Number(body.digits || 3))),
      prefix: body.prefix || null,
      suffix: body.suffix || null,
      recycleNumbers: !!body.recycleNumbers,
      delimiter: body.delimiter || ",",
      allowCodeEdit: body.allowCodeEdit !== false,
      regenerateOnType: body.regenerateOnType !== false
    }
  });
  return NextResponse.json(updated);
}
