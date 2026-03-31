import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/http";
import { storageBinSlotCountPreviewSchema } from "@/lib/validation";
import { mapPlacementError, previewStorageBinSlotCountChange } from "@/lib/storage-bins";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, storageBinSlotCountPreviewSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof storageBinSlotCountPreviewSchema.parse>;

  try {
    return NextResponse.json(await previewStorageBinSlotCountChange(prisma, body));
  } catch (error) {
    const placementError = mapPlacementError(error);
    if (placementError) {
      return NextResponse.json(placementError.body, { status: placementError.status });
    }
    throw error;
  }
}
