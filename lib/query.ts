import { Prisma } from "@prisma/client";

export function buildItemFilter(params: URLSearchParams, allowedLocationIds: string[] | null): Prisma.ItemWhereInput {
  const q = params.get("q")?.trim();
  const categoryId = params.get("categoryId");
  const locationId = params.get("storageLocationId");
  const lowStock = params.get("lowStock") === "1";
  const hasImages = params.get("hasImages") === "1";
  const hasAttachments = params.get("hasAttachments") === "1";
  const hasReservations = params.get("hasReservations") === "1";
  const tagId = params.get("tagId");
  const area = params.get("storageArea");
  const bin = params.get("bin");
  const includeDeleted = params.get("includeDeleted") === "1";
  const includeArchived = params.get("includeArchived") === "1";
  const archivedOnly = params.get("archived") === "1";
  const customFieldId = params.get("customFieldId");
  const customValue = params.get("customValue");

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
      { barcodeEan: { contains: q } },
      { tags: { some: { tag: { name: { contains: q } } } } }
    ];
  }

  if (categoryId) where.categoryId = categoryId;
  if (locationId) where.storageLocationId = locationId;
  if (tagId) where.tags = { some: { tagId } };
  if (area) where.storageArea = { contains: area };
  if (bin) where.bin = { contains: bin };
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

  if (allowedLocationIds && allowedLocationIds.length) {
    where.storageLocationId = {
      in: locationId ? [locationId].filter((id) => allowedLocationIds.includes(id)) : allowedLocationIds
    };
  }

  if (allowedLocationIds && !allowedLocationIds.length) {
    where.id = "__none__";
  }

  return where;
}
