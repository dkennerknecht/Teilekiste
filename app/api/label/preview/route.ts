import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { previewLabelCode } from "@/lib/label-code";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const areaId = req.nextUrl.searchParams.get("areaId");
  const typeId = req.nextUrl.searchParams.get("typeId");
  if (!areaId || !typeId) return NextResponse.json({ error: "areaId/typeId required" }, { status: 400 });
  const preview = await previewLabelCode(areaId, typeId);
  return NextResponse.json({ preview });
}
