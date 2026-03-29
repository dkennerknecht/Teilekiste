import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { collectCustomFieldSuggestions } from "@/lib/custom-fields";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const fieldId = req.nextUrl.searchParams.get("fieldId");
  const query = req.nextUrl.searchParams.get("q") || "";
  if (!fieldId) {
    return NextResponse.json({ error: "fieldId is required" }, { status: 400 });
  }

  const field = await prisma.customField.findUnique({
    where: { id: fieldId },
    select: {
      id: true,
      options: true,
      valueCatalog: true
    }
  });

  if (!field) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const suggestions = await collectCustomFieldSuggestions(prisma, field, query);
  return NextResponse.json({ suggestions });
}
