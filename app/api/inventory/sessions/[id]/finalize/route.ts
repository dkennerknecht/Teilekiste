import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { finalizeInventorySession, mapInventorySessionError } from "@/lib/inventory-sessions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  try {
    const result = await prisma.$transaction((tx) =>
      finalizeInventorySession(tx, {
        sessionId: params.id,
        viewer: {
          id: auth.user!.id,
          role: auth.user!.role
        },
        allowedLocationIds
      })
    );

    return NextResponse.json({
      ok: true,
      ...result
    });
  } catch (error) {
    const mapped = mapInventorySessionError(error);
    if (mapped) {
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
    throw error;
  }
}
