import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { previewLabelCode } from "@/lib/label-code";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const categoryId = req.nextUrl.searchParams.get("categoryId");
  const typeId = req.nextUrl.searchParams.get("typeId");
  if (!categoryId || !typeId) return NextResponse.json({ error: "categoryId/typeId required" }, { status: 400 });
  const preview = await previewLabelCode(categoryId, typeId);
  return NextResponse.json({ preview });
}
