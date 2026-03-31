import { Prisma } from "@prisma/client";
import type { AppRole } from "@/lib/permissions";
import { buildPlacementAccessWhere } from "@/lib/storage-bins";

export function buildItemFilter(
  params: URLSearchParams,
  allowedLocationIds: string[] | null,
  role: AppRole = "ADMIN"
): Prisma.ItemWhereInput {
  const q = params.get("q")?.trim();
  const categoryId = params.get("categoryId");
  const locationId = params.get("storageLocationId");
  const lowStock = params.get("lowStock") === "1";
  const hasImages = params.get("hasImages") === "1";
  const hasAttachments = params.get("hasAttachments") === "1";
  const hasReservations = params.get("hasReservations") === "1";
  const tagId = params.get("tagId");
  const area = params.get("storageArea");
  const includeDeleted = params.get("includeDeleted") === "1";
  const includeArchived = params.get("includeArchived") === "1";
  const archivedOnly = params.get("archived") === "1";
  const customFieldId = params.get("customFieldId");
  const customValue = params.get("customValue");
  const placementStatus = params.get("placementStatus");
  const storageShelfId = params.get("storageShelfId");
  const storageBinId = params.get("storageBinId");

  const where: Prisma.ItemWhereInput = {
    deletedAt: includeDeleted ? undefined : null,
    isArchived: includeArchived ? undefined : archivedOnly ? true : false
  };

  if (q) {
    where.OR = [
      { labelCode: { contains: q } },
      { name: { contains: q } },
      { description: { contains: q } },
      { mpn: { contains: q } },
      { manufacturer: { contains: q } },
      { storageShelf: { is: { code: { contains: q } } } },
      { storageShelf: { is: { name: { contains: q } } } },
      { storageBin: { is: { code: { contains: q } } } },
      { tags: { some: { tag: { name: { contains: q } } } } }
    ];
  }

  if (categoryId) where.categoryId = categoryId;
  if (locationId) where.storageLocationId = locationId;
  if (storageShelfId) where.storageShelfId = storageShelfId;
  if (storageBinId) where.storageBinId = storageBinId;
  if (placementStatus) where.placementStatus = placementStatus;
  if (tagId) where.tags = { some: { tagId } };
  if (area) where.storageArea = { contains: area };
  if (hasImages) where.images = { some: {} };
  if (hasAttachments) where.attachments = { some: {} };
  if (hasReservations) where.reservations = { some: {} };
  if (customFieldId && customValue !== null) {
    where.customValues = {
      some: {
        customFieldId,
        OR: [
          { valueJson: { equals: customValue as never } },
          { valueJson: { equals: JSON.stringify(customValue) as never } }
        ]
      }
    };
  }
  if (lowStock) {
    where.minStock = { not: null };
  }

  const accessWhere = buildPlacementAccessWhere(allowedLocationIds, role);
  if (accessWhere) {
    const baseAccessWhere =
      allowedLocationIds && locationId
        ? buildPlacementAccessWhere(allowedLocationIds.filter((id) => id === locationId), role)
        : accessWhere;
    if (baseAccessWhere) {
      const currentAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...currentAnd, baseAccessWhere];
    }
  }

  return where;
}
