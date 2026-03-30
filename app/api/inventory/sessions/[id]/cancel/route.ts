import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { cancelInventorySession, mapInventorySessionError } from "@/lib/inventory-sessions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  try {
    await prisma.$transaction((tx) =>
      cancelInventorySession(tx, {
        sessionId: params.id,
        viewer: {
          id: auth.user!.id,
          role: auth.user!.role
        },
        allowedLocationIds
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = mapInventorySessionError(error);
    if (mapped) {
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
    throw error;
  }
}
