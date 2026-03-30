import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import { findDuplicateCandidates } from "@/lib/item-duplicates";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const name = req.nextUrl.searchParams.get("name") || "";
  const mpn = req.nextUrl.searchParams.get("mpn") || "";
  const manufacturer = req.nextUrl.searchParams.get("manufacturer") || "";
  const categoryId = req.nextUrl.searchParams.get("categoryId") || "";
  const typeId = req.nextUrl.searchParams.get("typeId") || "";
  const storageLocationId = req.nextUrl.searchParams.get("storageLocationId") || "";
  const unit = req.nextUrl.searchParams.get("unit") || "";
  const itemId = req.nextUrl.searchParams.get("itemId") || "";

  if (!name && !mpn && !manufacturer) return NextResponse.json([]);

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      mergedIntoItemId: null
    },
    select: {
      id: true,
      labelCode: true,
      name: true,
      categoryId: true,
      typeId: true,
      storageLocationId: true,
      unit: true,
      manufacturer: true,
      mpn: true,
      isArchived: true,
      deletedAt: true,
      mergedIntoItemId: true,
      mergedAt: true,
      category: {
        select: { id: true, name: true, code: true }
      },
      labelType: {
        select: { id: true, code: true, name: true }
      }
    }
  });

  const results = findDuplicateCandidates(items, {
    itemId: itemId || null,
    name,
    manufacturer,
    mpn,
    categoryId: categoryId || null,
    typeId: typeId || null,
    storageLocationId: storageLocationId || null,
    unit: unit || null
  });

  return NextResponse.json(
    results.map((entry) => ({
      ...entry.item,
      score: entry.score,
      reasons: entry.reasons,
      mergeEligible: entry.mergeEligible,
      mergeBlockedReasons: entry.mergeBlockedReasons
    }))
  );
}
