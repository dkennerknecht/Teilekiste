import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/http";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import {
  createInventorySession,
  mapInventorySessionError,
  serializeInventorySessionListEntry
} from "@/lib/inventory-sessions";
import { inventorySessionCreateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const sessions = await prisma.inventorySession.findMany({
    where: allowedLocationIds
      ? {
          storageLocationId: {
            in: allowedLocationIds.length ? allowedLocationIds : ["__none__"]
          }
        }
      : undefined,
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
        select: {
          expectedStock: true,
          countedStock: true
        }
      }
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });

  return NextResponse.json({
    canCreate: auth.user!.role === "ADMIN" || auth.user!.role === "READ_WRITE",
    sessions: sessions.map((session) =>
      serializeInventorySessionListEntry(session as never, {
        id: auth.user!.id,
        role: auth.user!.role
      })
    )
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, inventorySessionCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof inventorySessionCreateSchema.parse>;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  try {
    const created = await prisma.$transaction((tx) =>
      createInventorySession(tx, {
        storageLocationId: body.storageLocationId,
        storageArea: body.storageArea,
        title: body.title,
        note: body.note,
        ownerUserId: auth.user!.id,
        createdByUserId: auth.user!.id,
        allowedLocationIds
      })
    );

    return NextResponse.json({
      id: created.id,
      title: created.title,
      status: created.status,
      storageLocationId: created.storageLocationId,
      storageArea: created.storageArea,
      note: created.note,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      storageLocation: created.storageLocation,
      ownerUser: created.ownerUser,
      createdByUser: created.createdByUser,
      rowCount: created.rowCount
    });
  } catch (error) {
    const mapped = mapInventorySessionError(error);
    if (mapped) {
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
    throw error;
  }
}
