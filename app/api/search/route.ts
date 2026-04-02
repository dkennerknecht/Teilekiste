import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { parsePagination } from "@/lib/http";
import { buildPlacementAccessWhere, formatItemPosition } from "@/lib/storage-bins";
import { parseManagedDrawerLabel, parseManagedStorageShelfLabel } from "@/lib/storage-labels";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);
  const { limit } = parsePagination(req.nextUrl.searchParams, 50);
  const managedDrawerLabel = parseManagedDrawerLabel(q);
  const managedShelfLabel = parseManagedStorageShelfLabel(q);

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
        ,
        ...(managedShelfLabel
          ? [
              {
                storageShelf: {
                  is: {
                    code: managedShelfLabel
                  }
                }
              }
            ]
          : []),
        ...(managedDrawerLabel
          ? [
              {
                AND: [
                  {
                    storageShelf: {
                      is: {
                        code: managedDrawerLabel.shelfCode
                      }
                    }
                  },
                  {
                    storageBin: {
                      is: {
                        code: managedDrawerLabel.binCode
                      }
                    }
                  }
                ]
              }
            ]
          : [])
      ],
      AND: buildPlacementAccessWhere(allowedLocationIds, auth.user!.role)
        ? [buildPlacementAccessWhere(allowedLocationIds, auth.user!.role)!]
        : undefined
    },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      storageShelf: {
        select: { id: true, name: true, code: true }
      },
      storageBin: {
        select: { id: true, code: true, slotCount: true }
      }
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
    return NextResponse.json(
      items.map((item) => {
        const displayPosition = formatItemPosition(item);
        return { ...item, displayPosition };
      })
    );
  }

  if (items.some((item) => item.id === mergedMatch.mergedIntoItemId)) {
    return NextResponse.json(
      items.map((item) => {
        const displayPosition = formatItemPosition(item);
        return { ...item, displayPosition };
      })
    );
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
      storageShelfId: true,
      storageBinId: true,
      binSlot: true,
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
      updatedAt: true,
      storageShelf: {
        select: { id: true, name: true, code: true }
      },
      storageBin: {
        select: { id: true, code: true, slotCount: true }
      }
    }
  });

  if (!mergedTarget || mergedTarget.deletedAt || mergedTarget.isArchived) {
    return NextResponse.json(
      items.map((item) => {
        const displayPosition = formatItemPosition(item);
        return { ...item, displayPosition };
      })
    );
  }

  if (mergedTarget.storageLocationId && allowedLocationIds && !allowedLocationIds.includes(mergedTarget.storageLocationId)) {
    return NextResponse.json(
      items.map((item) => {
        const displayPosition = formatItemPosition(item);
        return { ...item, displayPosition };
      })
    );
  }

  return NextResponse.json(
    [mergedTarget, ...items]
      .slice(0, limit)
      .map((item) => {
        const displayPosition = formatItemPosition(item as never);
        return { ...item, displayPosition };
      })
  );
}
