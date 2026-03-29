import { prisma } from "@/lib/prisma";

function buildLocationFilter(allowedLocationIds: string[] | null | undefined) {
  if (!allowedLocationIds) return undefined;
  return { in: allowedLocationIds.length ? allowedLocationIds : ["__none__"] };
}

export async function buildBackupPayload(input?: {
  allowedLocationIds?: string[] | null;
  includeUsers?: boolean;
  includeAuditLogs?: boolean;
}) {
  const allowedLocationIds = input?.allowedLocationIds ?? null;
  const locationFilter = buildLocationFilter(allowedLocationIds);
  const importProfileTable = (prisma as any).importProfile as {
    findMany: (args?: unknown) => Promise<any[]>;
  };

  const items = await prisma.item.findMany({
    where: { storageLocationId: locationFilter },
    include: {
      tags: true,
      images: true,
      attachments: true,
      reservations: true,
      movements: true,
      customValues: true
    }
  });

  const itemIds = items.map((item) => item.id);
  const [categories, tags, locations, shelves, customFields, technicalFieldScopeAssignments, importProfiles, areas, types, labelConfig, sequenceCounters, boms, users, auditLogs] =
    await Promise.all([
      prisma.category.findMany(),
      prisma.tag.findMany(),
      prisma.storageLocation.findMany({
        where: locationFilter ? { id: locationFilter } : undefined
      }),
      prisma.storageShelf.findMany({
        where: locationFilter ? { storageLocationId: locationFilter } : undefined
      }),
      prisma.customField.findMany(),
      prisma.technicalFieldScopeAssignment.findMany(),
      importProfileTable.findMany(),
      prisma.area.findMany(),
      prisma.labelType.findMany(),
      prisma.labelConfig.findUnique({ where: { id: "default" } }),
      prisma.sequenceCounter.findMany(),
      itemIds.length
        ? prisma.billOfMaterial.findMany({
            where: {
              parentItemId: { in: itemIds },
              childItemId: { in: itemIds }
            }
          })
        : Promise.resolve([]),
      input?.includeUsers
        ? prisma.user.findMany({
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              passwordHash: true,
              allowedScopes: {
                select: { storageLocationId: true }
              }
            }
          })
        : Promise.resolve([]),
      input?.includeAuditLogs
        ? prisma.auditLog.findMany({
            where: itemIds.length
              ? {
                  OR: [
                    { entity: { not: "Item" } },
                    { entity: "Item", entityId: { in: itemIds } }
                  ]
                }
              : undefined
          })
        : Promise.resolve([])
    ]);

  return {
    exportedAt: new Date().toISOString(),
    items,
    boms,
    categories,
    tags,
    locations,
    shelves,
    customFields,
    technicalFieldScopeAssignments,
    importProfiles,
    areas,
    types,
    labelConfig,
    sequenceCounters,
    ...(input?.includeUsers
      ? {
          users: users.map((user: any) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            passwordHash: user.passwordHash,
            allowedLocationIds: user.allowedScopes.map((scope: any) => scope.storageLocationId)
          }))
        }
      : {}),
    ...(input?.includeAuditLogs ? { auditLogs } : {})
  };
}
