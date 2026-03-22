import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const locationFilter = allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined;

  const payload = {
    exportedAt: new Date().toISOString(),
    items: await prisma.item.findMany({
      where: { storageLocationId: locationFilter },
      include: { tags: true, images: true, attachments: true, reservations: true, movements: true, customValues: true }
    }),
    categories: await prisma.category.findMany(),
    tags: await prisma.tag.findMany(),
    locations: await prisma.storageLocation.findMany(),
    customFields: await prisma.customField.findMany(),
    areas: await prisma.area.findMany(),
    types: await prisma.labelType.findMany()
  };

  return NextResponse.json(payload);
}
