import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { resolveAllowedLocationIds } from "@/lib/permissions";
import { runImportApplyWorkflow } from "@/lib/import-workflow";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const form = await req.formData();
  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const result = await runImportApplyWorkflow({
    form,
    allowedLocationIds,
    user: { id: auth.user!.id }
  });

  return NextResponse.json(result.body, { status: result.status });
}
