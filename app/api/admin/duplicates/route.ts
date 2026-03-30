import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { parsePagination } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildDuplicatePairs } from "@/lib/item-duplicates";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const minScore = Math.max(0, Math.trunc(Number(req.nextUrl.searchParams.get("minScore") || "45")));
  const onlyMergeEligible = req.nextUrl.searchParams.get("onlyMergeEligible") === "1";
  const { limit, offset } = parsePagination(req.nextUrl.searchParams, 200);

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

  const pairs = buildDuplicatePairs(items, {
    minScore,
    onlyMergeEligible
  });

  return NextResponse.json({
    total: pairs.length,
    limit,
    offset,
    items: pairs.slice(offset, offset + limit)
  });
}
