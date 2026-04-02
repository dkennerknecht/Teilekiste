import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/http";
import { storageBinMoveSchema } from "@/lib/validation";
import { mapPlacementError, moveStorageBinContents } from "@/lib/storage-bins";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, storageBinMoveSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof storageBinMoveSchema.parse>;

  try {
    const result = await prisma.$transaction((tx) => moveStorageBinContents(tx, body));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const placementError = mapPlacementError(error);
    if (placementError) {
      return NextResponse.json(placementError.body, { status: placementError.status });
    }
    throw error;
  }
}
