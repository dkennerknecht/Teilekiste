import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import mime from "mime-types";
import { env } from "@/lib/env";
import { requireAuth } from "@/lib/api";

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const filePath = path.join("/", ...params.path);
  if (!filePath.startsWith(env.UPLOAD_DIR) && !filePath.startsWith(env.ATTACHMENT_DIR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await fs.readFile(filePath);
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    return new NextResponse(data, { headers: { "content-type": String(mimeType) } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
