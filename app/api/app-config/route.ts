import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAppLanguage } from "@/lib/app-language";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await prisma.labelConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" }
  });

  return NextResponse.json({
    language: normalizeAppLanguage(config.language)
  });
}
