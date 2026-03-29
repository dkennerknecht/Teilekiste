import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { parsePagination } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);
  const { limit } = parsePagination(req.nextUrl.searchParams, 50);

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      isArchived: false,
      mergedIntoItemId: null,
      OR: [
        { labelCode: { equals: q } },
        { labelCode: { contains: q } },
        { name: { contains: q } },
        { mpn: { contains: q } },
        { manufacturer: { contains: q } }
      ],
      storageLocationId: allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined
    },
    take: limit,
    orderBy: { updatedAt: "desc" }
  });

  const mergedMatch = await prisma.item.findFirst({
    where: {
      labelCode: q,
      mergedIntoItemId: { not: null }
    },
    select: {
      mergedIntoItemId: true
    }
  });

  if (!mergedMatch?.mergedIntoItemId) {
    return NextResponse.json(items);
  }

  if (items.some((item) => item.id === mergedMatch.mergedIntoItemId)) {
    return NextResponse.json(items);
  }

  const mergedTarget = await prisma.item.findUnique({
    where: { id: mergedMatch.mergedIntoItemId },
    select: {
      id: true,
      labelCode: true,
      name: true,
      categoryId: true,
      typeId: true,
      storageLocationId: true,
      storageArea: true,
      bin: true,
      stock: true,
      unit: true,
      minStock: true,
      manufacturer: true,
      mpn: true,
      datasheetUrl: true,
      purchaseUrl: true,
      isArchived: true,
      deletedAt: true,
      mergedIntoItemId: true,
      mergedAt: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!mergedTarget || mergedTarget.deletedAt || mergedTarget.isArchived) {
    return NextResponse.json(items);
  }

  if (allowedLocationIds && !allowedLocationIds.includes(mergedTarget.storageLocationId)) {
    return NextResponse.json(items);
  }

  return NextResponse.json([mergedTarget, ...items].slice(0, limit));
}
