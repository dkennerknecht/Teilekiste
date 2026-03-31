import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { buildInventorySessionDetail } from "@/lib/inventory-sessions";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const session = await prisma.inventorySession.findUnique({
    where: { id: params.id },
    include: {
      storageLocation: {
        select: { id: true, name: true, code: true }
      },
      ownerUser: {
        select: { id: true, name: true, email: true }
      },
      createdByUser: {
        select: { id: true, name: true, email: true }
      },
      rows: {
        include: {
          countedByUser: {
            select: { id: true, name: true, email: true }
          },
          item: {
            select: {
              id: true,
              labelCode: true,
              name: true,
              unit: true,
              stock: true,
              storageArea: true,
              storageShelf: {
                select: { code: true }
              },
              storageBin: {
                select: { code: true }
              },
              binSlot: true,
              deletedAt: true,
              isArchived: true
            }
          }
        },
        orderBy: [{ storageArea: "asc" }, { storageBinCode: "asc" }, { binSlot: "asc" }, { labelCode: "asc" }]
      }
    }
  });

  if (!session) {
    return NextResponse.json({ error: "Inventur-Session nicht gefunden" }, { status: 404 });
  }

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  if (allowedLocationIds && !allowedLocationIds.includes(session.storageLocationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const detail = await buildInventorySessionDetail(prisma, session as never, {
    id: auth.user!.id,
    role: auth.user!.role
  });

  return NextResponse.json(detail);
}
