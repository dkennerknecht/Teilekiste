import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/http";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { inventorySessionCountsSchema } from "@/lib/validation";
import { mapInventorySessionError, updateInventorySessionCounts } from "@/lib/inventory-sessions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWriteAccess(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, inventorySessionCountsSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof inventorySessionCountsSchema.parse>;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);

  try {
    const result = await prisma.$transaction((tx) =>
      updateInventorySessionCounts(tx, {
        sessionId: params.id,
        counts: body.counts || [],
        viewer: {
          id: auth.user!.id,
          role: auth.user!.role
        },
        allowedLocationIds
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapInventorySessionError(error);
    if (mapped) {
      return NextResponse.json(mapped.body, { status: mapped.status });
    }
    throw error;
  }
}
