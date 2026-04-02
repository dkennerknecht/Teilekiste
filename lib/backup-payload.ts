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
  const technicalFieldPresetTable = (prisma as any).technicalFieldPreset as {
    findMany?: (args?: unknown) => Promise<any[]>;
  };

  const items = await prisma.item.findMany({
    where: locationFilter
      ? {
          OR: [
            { storageLocationId: locationFilter },
            { storageLocationId: null }
          ]
        }
      : undefined,
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
  const inventorySessions = await prisma.inventorySession.findMany({
    where: locationFilter ? { storageLocationId: locationFilter } : undefined,
    include: {
      rows: true
    }
  });
  const inventorySessionIds = inventorySessions.map((session) => session.id);

  const [categories, tags, locations, shelves, bins, customFields, technicalFieldScopeAssignments, technicalFieldPresets, importProfiles, areas, types, labelConfig, sequenceCounters, categoryTypeCounters, boms, users, auditLogs, favorites, recentViews, apiTokens, accounts, sessions, verificationTokens] =
    await Promise.all([
      prisma.category.findMany(),
      prisma.tag.findMany(),
      prisma.storageLocation.findMany({
        where: locationFilter ? { id: locationFilter } : undefined
      }),
      prisma.storageShelf.findMany({
        where: locationFilter ? { storageLocationId: locationFilter } : undefined
      }),
      prisma.storageBin.findMany({
        where: locationFilter ? { storageLocationId: locationFilter } : undefined
      }),
      prisma.customField.findMany(),
      prisma.technicalFieldScopeAssignment.findMany(),
      technicalFieldPresetTable?.findMany ? technicalFieldPresetTable.findMany() : Promise.resolve([]),
      importProfileTable.findMany(),
      prisma.area.findMany(),
      prisma.labelType.findMany(),
      prisma.labelConfig.findUnique({ where: { id: "default" } }),
      prisma.sequenceCounter.findMany(),
      prisma.categoryTypeCounter.findMany(),
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
        : Promise.resolve([]),
      itemIds.length
        ? prisma.favorite.findMany({
            where: {
              itemId: { in: itemIds }
            }
          })
        : Promise.resolve([]),
      itemIds.length
        ? prisma.recentView.findMany({
            where: {
              itemId: { in: itemIds }
            }
          })
        : Promise.resolve([]),
      input?.includeUsers ? prisma.apiToken.findMany() : Promise.resolve([]),
      input?.includeUsers ? prisma.account.findMany() : Promise.resolve([]),
      input?.includeUsers ? prisma.session.findMany() : Promise.resolve([]),
      input?.includeUsers ? prisma.verificationToken.findMany() : Promise.resolve([])
    ]);

  return {
    exportedAt: new Date().toISOString(),
    items,
    boms,
    categories,
    tags,
    locations,
    shelves,
    bins,
    customFields,
    technicalFieldScopeAssignments,
    technicalFieldPresets,
    importProfiles,
    inventorySessions: inventorySessions.map(({ rows, ...session }) => session),
    inventorySessionRows: inventorySessions.flatMap((session) => session.rows),
    favorites,
    recentViews,
    apiTokens,
    accounts,
    sessions,
    verificationTokens,
    areas,
    types,
    labelConfig,
    sequenceCounters,
    categoryTypeCounters,
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
