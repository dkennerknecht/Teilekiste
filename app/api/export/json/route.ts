import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { buildBackupPayload } from "@/lib/backup-payload";
import { resolveAllowedLocationIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const allowedLocationIds = await resolveAllowedLocationIds(auth.user! as never);
  const payload = await buildBackupPayload({ allowedLocationIds });

  return NextResponse.json(payload);
}
