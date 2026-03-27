import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { env } from "@/lib/env";
import { sanitizeFileName } from "@/lib/fs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const name = String(req.nextUrl.searchParams.get("name") || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Dateiname fehlt" }, { status: 400 });
  }

  const safeName = sanitizeFileName(name);
  if (!safeName.endsWith(".zip") || safeName !== name) {
    return NextResponse.json({ error: "Ungueltiger Dateiname" }, { status: 400 });
  }

  const filePath = path.join(env.BACKUP_DIR, safeName);

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${safeName}"`,
        "cache-control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Backup nicht gefunden" }, { status: 404 });
  }
}
