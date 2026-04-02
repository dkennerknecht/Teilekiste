import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { serializeStoredQuantity } from "@/lib/quantity";
import { formatItemPosition } from "@/lib/storage-bins";
import { formatStorageBinLabel, normalizeStorageShelfCode } from "@/lib/storage-labels";
import { buildAbsoluteUrl } from "@/lib/request-origin";

type PtouchLabelRow = {
  labelUrl: string;
  labelName: string;
};

function normalizeCsvDelimiter(value: string | null) {
  if (value === "," || value === "comma") return ",";
  if (value === "\t" || value === "tab") return "\t";
  return ";";
}

function toPtouchResponse(rows: PtouchLabelRow[], filename: string, delimiter: string) {
  const csv = toCsv(rows, delimiter);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=${filename}`
    }
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const delimiter = normalizeCsvDelimiter(req.nextUrl.searchParams.get("delimiter"));
  const mode = req.nextUrl.searchParams.get("mode") || "all";
  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  if (mode === "drawers" || mode === "shelves" || mode === "all") {
    const requestOrigin = buildAbsoluteUrl(req, "/").replace(/\/$/, "");
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

    const drawers: PtouchLabelRow[] = bins.map((bin) => ({
      labelUrl: `${requestOrigin}/bins/${encodeURIComponent(
        formatStorageBinLabel({
          shelfCode: bin.storageShelf?.code || null,
          binCode: bin.code
        }) || bin.code
      )}`,
      labelName:
        formatStorageBinLabel({
          shelfCode: bin.storageShelf?.code || null,
          binCode: bin.code
        }) || bin.code
    }));

    const shelves = await prisma.storageShelf.findMany({
      where: {
        storageLocationId: allowedLocationIds ? { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } : undefined,
        code: { not: null }
      },
      orderBy: [{ storageLocation: { name: "asc" } }, { code: "asc" }, { name: "asc" }]
    });

    const shelfRows: PtouchLabelRow[] = shelves.map((shelf) => ({
      labelUrl: `${requestOrigin}/shelves/${encodeURIComponent(shelf.id)}`,
      labelName: normalizeStorageShelfCode(shelf.code) || shelf.name
    }));

    if (mode === "shelves") {
      return toPtouchResponse(shelfRows, "ptouch-shelves.csv", delimiter);
    }

    if (mode === "drawers") {
      return toPtouchResponse(drawers, "ptouch-drawers.csv", delimiter);
    }

    return toPtouchResponse(
      [...shelfRows, ...drawers].sort((left, right) => left.labelName.localeCompare(right.labelName)),
      "ptouch-all-labels.csv",
      delimiter
    );
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
