import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildDuplicateMergePreview, DuplicateMergeError } from "@/lib/item-merge";
import { duplicateMergePreviewSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, duplicateMergePreviewSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof duplicateMergePreviewSchema.parse>;

  try {
    return NextResponse.json(await buildDuplicateMergePreview(prisma, body));
  } catch (error) {
    if (error instanceof DuplicateMergeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
