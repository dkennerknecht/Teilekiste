import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { serializeStoredQuantity } from "@/lib/quantity";
import { formatItemPosition, normalizeStorageBinCode, normalizeStorageShelfCode } from "@/lib/storage-bins";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const delimiter = req.nextUrl.searchParams.get("delimiter") || ";";
  const mode = req.nextUrl.searchParams.get("mode") || "items";
  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  if (mode === "drawers") {
    const bins = await prisma.storageBin.findMany({
      where: {
        isActive: true,
        storageLocationId: allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined
      },
      include: {
        storageShelf: {
          select: { id: true, code: true }
        }
      },
      orderBy: [{ storageShelf: { code: "asc" } }, { code: "asc" }]
    });

    const csv = toCsv(
      bins.map((bin) => ({
        drawerUrl: `${env.APP_BASE_URL}/bins/${encodeURIComponent(bin.id)}`,
        drawerName: normalizeStorageBinCode(bin.code) || bin.code
      })),
      ";"
    );

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=ptouch-drawers.csv"
      }
    });
  }

  if (mode === "shelves") {
    const shelves = await prisma.storageShelf.findMany({
      where: {
        storageLocationId: allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined,
        code: { not: null }
      },
      orderBy: [{ storageLocation: { name: "asc" } }, { code: "asc" }, { name: "asc" }]
    });

    const csv = toCsv(
      shelves.map((shelf) => ({
        shelfUrl: `${env.APP_BASE_URL}/shelves/${encodeURIComponent(shelf.id)}`,
        shelfCode: normalizeStorageShelfCode(shelf.code) || shelf.name,
        shelfDescription: shelf.description || shelf.name
      })),
      ";"
    );

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=ptouch-shelves.csv"
      }
    });
  }

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
    storageLocation: item.storageLocation?.name || "",
    position: formatItemPosition(item) || "",
    category: item.category.name,
    reserved: serializeStoredQuantity(item.unit, item.reservations.reduce((sum, r) => sum + r.reservedQty, 0)),
    unit: item.unit
  }));

  const csv = toCsv(rows, delimiter);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=ptouch-labels.csv"
    }
  });
}
