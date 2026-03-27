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

  return NextResponse.json(items);
}
