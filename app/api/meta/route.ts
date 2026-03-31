import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { syncLabelCatalog, SYSTEM_LABEL_AREA } from "@/lib/label-catalog";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const { areaId } = await syncLabelCatalog(prisma);

  const [categories, locations, shelves, bins, types, tags, customFields] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.storageLocation.findMany({
      where: allowedLocationIds ? { id: { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } } : undefined,
      orderBy: { name: "asc" }
    }),
    prisma.storageShelf.findMany({
      where: allowedLocationIds ? { storageLocationId: { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } } : undefined,
      orderBy: [{ storageLocation: { name: "asc" } }, { name: "asc" }],
      include: {
        storageLocation: {
          select: { id: true, name: true, code: true }
        }
      }
    }),
    prisma.storageBin.findMany({
      where: allowedLocationIds ? { storageLocationId: { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } } : undefined,
      include: {
        storageLocation: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: [{ code: "asc" }]
    }),
    prisma.labelType.findMany({ where: { active: true, areaId }, orderBy: { code: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.customField.findMany({
      where: { isActive: true },
      include: {
        category: {
          select: { id: true, name: true, code: true }
        },
        labelType: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { key: "asc" }]
    })
  ]);

  return NextResponse.json({
    categories,
    locations,
    shelves,
    bins,
    areas: [],
    systemAreaCode: SYSTEM_LABEL_AREA.code,
    types,
    tags,
    customFields
  });
}
