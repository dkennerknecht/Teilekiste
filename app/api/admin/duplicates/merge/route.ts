import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { DuplicateMergeError, performDuplicateMerge } from "@/lib/item-merge";
import { duplicateMergeSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, duplicateMergeSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof duplicateMergeSchema.parse>;

  try {
    const result = await prisma.$transaction((tx) =>
      performDuplicateMerge(tx, {
        sourceItemId: body.sourceItemId,
        targetItemId: body.targetItemId,
        fieldSelections: body.fieldSelections,
        customFieldSelections: body.customFieldSelections,
        userId: auth.user!.id
      })
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateMergeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
