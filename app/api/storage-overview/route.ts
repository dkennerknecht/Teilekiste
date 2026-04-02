import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { serializeStoredQuantity } from "@/lib/quantity";
import { getAvailableQty, getReservedQty } from "@/lib/stock";
import { formatDrawerPosition, formatStorageBinLabel, formatStorageShelfLabel } from "@/lib/storage-labels";

function normalizeQuery(value: string | null) {
  const normalized = String(value || "").trim();
  return normalized ? normalized.toLowerCase() : "";
}

function matchesQuery(query: string, values: Array<string | null | undefined>) {
  if (!query) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(query));
}

function parseBooleanFilter(value: string | null, defaultValue: boolean) {
  if (value === null) return defaultValue;
  return value !== "0";
}

function normalizeModeFilter(value: string | null) {
  return value === "open" || value === "drawer" ? value : "all";
}

function buildItemDisplayPosition(input: {
  locationName: string | null | undefined;
  shelfCode: string | null | undefined;
  shelfName: string | null | undefined;
  binCode?: string | null;
  binSlot?: number | null;
  slotCount?: number | null;
}) {
  const shelfLabel = formatStorageShelfLabel(input.shelfCode, input.shelfName);
  const drawerLabel = input.binCode
    ? formatDrawerPosition(input.binCode, input.binSlot ?? null, input.slotCount ?? null, input.shelfCode ?? null)
    : null;
  return [input.locationName || null, drawerLabel || shelfLabel].filter(Boolean).join(" / ") || null;
}

function serializeOverviewItem(
  item: {
    id: string;
    labelCode: string;
    name: string;
    unit: string;
    stock: number;
    incomingQty: number;
    placementStatus: string;
    binSlot: number | null;
    images: Array<{
      path: string;
      thumbPath: string | null;
      caption: string | null;
      isPrimary: boolean;
    }>;
    reservations: Array<{ reservedQty: number }>;
  },
  input: {
    locationName: string | null | undefined;
    shelfCode: string | null | undefined;
    shelfName: string | null | undefined;
    binCode?: string | null;
    slotCount?: number | null;
  }
) {
  const reservedQty = getReservedQty(item.reservations);
  const availableStock = getAvailableQty(item.stock, reservedQty, item.placementStatus);
  return {
    id: item.id,
    labelCode: item.labelCode,
    name: item.name,
    unit: item.unit,
    stock: serializeStoredQuantity(item.unit, item.stock),
    availableStock: serializeStoredQuantity(item.unit, availableStock),
    incomingQty: serializeStoredQuantity(item.unit, item.incomingQty),
    placementStatus: item.placementStatus,
    binSlot: item.binSlot ?? null,
    primaryImage: item.images[0] ?? null,
    displayPosition: buildItemDisplayPosition({
      locationName: input.locationName,
      shelfCode: input.shelfCode,
      shelfName: input.shelfName,
      binCode: input.binCode || null,
      binSlot: item.binSlot ?? null,
      slotCount: input.slotCount ?? null
    })
  };
}

function buildBinSummary(bin: { slotCount: number; items: Array<{ binSlot: number | null }> }) {
  const occupiedSlots = new Set(
    bin.items
      .map((item) => (typeof item.binSlot === "number" ? item.binSlot : bin.slotCount <= 1 ? 1 : null))
      .filter((value): value is number => typeof value === "number")
  );
  return {
    itemCount: bin.items.length,
    occupiedCount: occupiedSlots.size,
    freeSlotCount: Math.max(0, bin.slotCount - occupiedSlots.size)
  };
}

function buildShelfSummary(shelf: {
  mode: string;
  items: Array<unknown>;
  bins: Array<{ items: Array<unknown> }>;
}) {
  const drawerCount = shelf.bins.length;
  const itemCount = shelf.items.length + shelf.bins.reduce((sum, bin) => sum + bin.items.length, 0);
  const emptyDrawerCount = shelf.bins.filter((bin) => bin.items.length === 0).length;
  return {
    itemCount,
    drawerCount,
    occupiedDrawerCount: Math.max(0, drawerCount - emptyDrawerCount),
    emptyDrawerCount,
    mode: shelf.mode
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const searchParams = req.nextUrl.searchParams;
  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const requestedLocationId = searchParams.get("storageLocationId");
  const shelfQuery = normalizeQuery(searchParams.get("shelfQuery"));
  const drawerQuery = normalizeQuery(searchParams.get("drawerQuery"));
  const showEmptyShelves = parseBooleanFilter(searchParams.get("showEmptyShelves"), true);
  const showEmptyDrawers = parseBooleanFilter(searchParams.get("showEmptyDrawers"), true);
  const mode = normalizeModeFilter(searchParams.get("mode"));

  const availableLocationsWhere = allowedLocationIds
    ? { id: { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] } }
    : undefined;
  const availableLocations = await prisma.storageLocation.findMany({
    where: availableLocationsWhere,
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" }
  });

  const effectiveLocationIds =
    requestedLocationId
      ? allowedLocationIds
        ? allowedLocationIds.includes(requestedLocationId)
          ? [requestedLocationId]
          : []
        : [requestedLocationId]
      : allowedLocationIds;

  const shelves = await prisma.storageShelf.findMany({
    where: {
      storageLocationId:
        effectiveLocationIds !== null && effectiveLocationIds !== undefined
          ? { in: effectiveLocationIds.length ? effectiveLocationIds : ["__none__"] }
          : undefined,
      mode:
        mode === "open"
          ? "OPEN_AREA"
          : mode === "drawer"
            ? "DRAWER_HOST"
            : undefined
    },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      items: {
        where: {
          deletedAt: null,
          isArchived: false,
          mergedIntoItemId: null,
          storageBinId: null
        },
        select: {
          id: true,
          labelCode: true,
          name: true,
          unit: true,
          stock: true,
          incomingQty: true,
          placementStatus: true,
          binSlot: true,
          images: {
            select: { path: true, thumbPath: true, caption: true, isPrimary: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 1
          },
          reservations: { select: { reservedQty: true } }
        },
        orderBy: [{ labelCode: "asc" }]
      },
      bins: {
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          slotCount: true,
          items: {
            where: {
              deletedAt: null,
              isArchived: false,
              mergedIntoItemId: null
            },
            select: {
              id: true,
              labelCode: true,
              name: true,
              unit: true,
              stock: true,
              incomingQty: true,
              placementStatus: true,
              binSlot: true,
              images: {
                select: { path: true, thumbPath: true, caption: true, isPrimary: true },
                orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                take: 1
              },
              reservations: { select: { reservedQty: true } }
            },
            orderBy: [{ binSlot: "asc" }, { labelCode: "asc" }]
          }
        },
        orderBy: [{ code: "asc" }]
      }
    },
    orderBy: [{ storageLocation: { name: "asc" } }, { code: "asc" }, { name: "asc" }]
  });

  const locations = shelves.reduce<Array<{
    id: string;
    name: string;
    code: string | null;
    summary: {
      shelfCount: number;
      drawerCount: number;
      itemCount: number;
      emptyShelfCount: number;
      emptyDrawerCount: number;
    };
    shelves: Array<any>;
  }>>((acc, shelf) => {
    const shelfDisplayCode = formatStorageShelfLabel(shelf.code, shelf.name);
    if (!matchesQuery(shelfQuery, [shelfDisplayCode, shelf.code, shelf.name, shelf.description])) {
      return acc;
    }

    const directItems = shelf.items.map((item) =>
      serializeOverviewItem(item, {
        locationName: shelf.storageLocation?.name,
        shelfCode: shelf.code,
        shelfName: shelf.name
      })
    );

    const visibleBins = shelf.bins
      .map((bin) => {
        const fullCode =
          formatStorageBinLabel({
            shelfCode: shelf.code || null,
            binCode: bin.code
          }) || bin.code;
        const items = bin.items.map((item) =>
          serializeOverviewItem(item, {
            locationName: shelf.storageLocation?.name,
            shelfCode: shelf.code,
            shelfName: shelf.name,
            binCode: bin.code,
            slotCount: bin.slotCount
          })
        );
        return {
          id: bin.id,
          code: bin.code,
          fullCode,
          slotCount: bin.slotCount,
          summary: buildBinSummary(bin),
          items
        };
      })
      .filter((bin) => matchesQuery(drawerQuery, [bin.fullCode, bin.code]))
      .filter((bin) => (showEmptyDrawers ? true : bin.items.length > 0));

    if (drawerQuery && visibleBins.length === 0) {
      return acc;
    }

    if (!showEmptyShelves && directItems.length === 0 && visibleBins.length === 0) {
      return acc;
    }

    const shelfEntry = {
      id: shelf.id,
      code: shelf.code,
      displayCode: shelfDisplayCode,
      name: shelf.name,
      description: shelf.description,
      mode: shelf.mode,
      summary: buildShelfSummary({
        mode: shelf.mode,
        items: directItems,
        bins: visibleBins
      }),
      items: directItems,
      bins: visibleBins
    };

    let locationEntry = acc.find((entry) => entry.id === shelf.storageLocationId);
    if (!locationEntry) {
      locationEntry = {
        id: shelf.storageLocationId,
        name: shelf.storageLocation.name,
        code: shelf.storageLocation.code,
        summary: {
          shelfCount: 0,
          drawerCount: 0,
          itemCount: 0,
          emptyShelfCount: 0,
          emptyDrawerCount: 0
        },
        shelves: []
      };
      acc.push(locationEntry);
    }

    locationEntry.shelves.push(shelfEntry);
    locationEntry.summary.shelfCount += 1;
    locationEntry.summary.drawerCount += shelfEntry.summary.drawerCount;
    locationEntry.summary.itemCount += shelfEntry.summary.itemCount;
    locationEntry.summary.emptyDrawerCount += shelfEntry.summary.emptyDrawerCount;
    if (shelfEntry.summary.itemCount === 0 && shelfEntry.summary.drawerCount === 0) {
      locationEntry.summary.emptyShelfCount += 1;
    }

    return acc;
  }, []);

  const summary = locations.reduce(
    (acc, location) => ({
      locationCount: acc.locationCount + 1,
      shelfCount: acc.shelfCount + location.summary.shelfCount,
      drawerCount: acc.drawerCount + location.summary.drawerCount,
      itemCount: acc.itemCount + location.summary.itemCount
    }),
    {
      locationCount: 0,
      shelfCount: 0,
      drawerCount: 0,
      itemCount: 0
    }
  );

  return NextResponse.json({
    availableLocations,
    summary,
    locations
  });
}
