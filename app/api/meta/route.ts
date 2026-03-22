import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  const [categories, locations, areas, types, tags, customFields] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.storageLocation.findMany({
      where: allowedLocationIds ? { id: { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } } : undefined,
      orderBy: { name: "asc" }
    }),
    prisma.area.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.labelType.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.customField.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
  ]);

  return NextResponse.json({ categories, locations, areas, types, tags, customFields });
}
