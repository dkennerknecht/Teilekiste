import { prisma } from "@/lib/prisma";

type AccessibleLocationIds = string[] | null;

function isLocationAllowed(storageLocationId: string, allowedLocationIds: AccessibleLocationIds) {
  return allowedLocationIds === null || allowedLocationIds.includes(storageLocationId);
}

export async function loadItemBom(itemId: string, allowedLocationIds: AccessibleLocationIds) {
  const [bomChildrenRaw, bomParentsRaw] = await Promise.all([
    prisma.billOfMaterial.findMany({
      where: { parentItemId: itemId },
      include: {
        child: {
          select: {
            id: true,
            labelCode: true,
            name: true,
            stock: true,
            minStock: true,
            unit: true,
            storageLocationId: true,
            storageLocation: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { child: { labelCode: "asc" } }
    }),
    prisma.billOfMaterial.findMany({
      where: { childItemId: itemId },
      include: {
        parent: {
          select: {
            id: true,
            labelCode: true,
            name: true,
            stock: true,
            unit: true,
            storageLocationId: true,
            storageLocation: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { parent: { labelCode: "asc" } }
    })
  ]);

  return {
    bomChildren: bomChildrenRaw.filter((entry) => isLocationAllowed(entry.child.storageLocationId, allowedLocationIds)),
    bomParents: bomParentsRaw.filter((entry) => isLocationAllowed(entry.parent.storageLocationId, allowedLocationIds))
  };
}
