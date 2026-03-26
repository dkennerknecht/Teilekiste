import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import mime from "mime-types";
import { env } from "@/lib/env";
import { requireAuth } from "@/lib/api";

function isPathWithinRoot(filePath: string, rootPath: string) {
  const relative = path.relative(rootPath, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const filePath = path.resolve("/", ...params.path);
  const allowedRoots = [env.UPLOAD_DIR, env.ATTACHMENT_DIR].map((root) => path.resolve(root));
  if (!allowedRoots.some((root) => isPathWithinRoot(filePath, root))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [realFilePath, realAllowedRoots] = await Promise.all([
      fs.realpath(filePath),
      Promise.all(allowedRoots.map(async (root) => fs.realpath(root).catch(() => root)))
    ]);

    if (!realAllowedRoots.some((root) => isPathWithinRoot(realFilePath, root))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await fs.readFile(realFilePath);
    const mimeType = mime.lookup(realFilePath) || "application/octet-stream";
    return new NextResponse(data, { headers: { "content-type": String(mimeType) } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
