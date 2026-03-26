import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { createBackupZip } from "@/lib/backup";
import { buildBackupPayload } from "@/lib/backup-payload";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const exportJson = await buildBackupPayload({
    includeUsers: true,
    includeAuditLogs: true
  });
  const result = await createBackupZip(exportJson);
  return NextResponse.json({ ok: true, ...result });
}
