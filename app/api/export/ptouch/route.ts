import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const delimiter = req.nextUrl.searchParams.get("delimiter") || ";";
  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      isArchived: false,
      storageLocationId: allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined
    },
    include: {
      storageLocation: true,
      category: true,
      reservations: true
    },
    orderBy: { labelCode: "asc" }
  });

  const rows = items.map((item) => ({
    labelCode: item.labelCode,
    name: item.name,
    storageLocation: item.storageLocation.name,
    bin: item.bin || "",
    category: item.category.name,
    reserved: item.reservations.reduce((sum, r) => sum + r.reservedQty, 0)
  }));

  const csv = toCsv(rows, delimiter);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=ptouch-labels.csv"
    }
  });
}
