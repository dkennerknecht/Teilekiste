import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

async function readBuildVersion() {
  try {
    return (await fs.readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim();
  } catch {
    return "dev";
  }
}

export async function GET() {
  const version = await readBuildVersion();
  return NextResponse.json(
    { version },
    {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate"
      }
    }
  );
}
