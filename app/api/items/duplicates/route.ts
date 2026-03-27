import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const name = req.nextUrl.searchParams.get("name") || "";
  const mpn = req.nextUrl.searchParams.get("mpn") || "";
  const barcodeEan = req.nextUrl.searchParams.get("barcodeEan") || "";

  const clauses = [] as Array<Record<string, unknown>>;
  if (name) clauses.push({ name: { contains: name } });
  if (mpn) clauses.push({ mpn: { contains: mpn } });
  if (barcodeEan) clauses.push({ barcodeEan: { contains: barcodeEan } });

  if (!clauses.length) return NextResponse.json([]);

  const results = await prisma.item.findMany({
    where: {
      deletedAt: null,
      isArchived: false,
      OR: clauses as never
    },
    take: 10
  });

  return NextResponse.json(results);
}
