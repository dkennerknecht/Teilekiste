import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateApiToken, hashApiToken } from "@/lib/token";
import { apiTokenCreateSchema } from "@/lib/validation";
import { parseJson } from "@/lib/http";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const tokens = await prisma.apiToken.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(tokens.map((t) => ({ ...t, tokenHash: undefined })));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const parsed = await parseJson<unknown>(req, apiTokenCreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data as ReturnType<typeof apiTokenCreateSchema.parse>;
  const userId = String(body.userId || auth.user!.id);
  const name = String(body.name || "Read-only token").slice(0, 120);
  const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;

  const plainToken = generateApiToken();
  const tokenHash = hashApiToken(plainToken);

  const created = await prisma.apiToken.create({
    data: {
      userId,
      name,
      tokenHash,
      isActive: true,
      expiresAt
    }
  });

  return NextResponse.json({
    id: created.id,
    name: created.name,
    userId: created.userId,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
    token: plainToken
  });
}
