import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { normalizeAppLanguage } from "@/lib/app-language";
import { appLanguageSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const config = await prisma.labelConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  return NextResponse.json({
    language: normalizeAppLanguage(config.language)
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, appLanguageSchema);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data as ReturnType<typeof appLanguageSchema.parse>;
  const updated = await prisma.labelConfig.upsert({
    where: { id: "default" },
    update: {
      language: normalizeAppLanguage(body.language)
    },
    create: {
      id: "default",
      language: normalizeAppLanguage(body.language)
    }
  });

  return NextResponse.json({
    language: normalizeAppLanguage(updated.language)
  });
}
