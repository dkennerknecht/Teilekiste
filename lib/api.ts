import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canWrite, resolveAllowedLocationIds } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hashApiToken } from "@/lib/token";
import { purgeExpiredDeletedItems } from "@/lib/trash";

function extractToken(req: NextRequest) {
  const fromHeader = req.headers.get("x-api-token");
  if (fromHeader) return fromHeader.trim();
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim();
}

async function authViaApiToken(req: NextRequest) {
  const rawToken = extractToken(req);
  if (!rawToken) return null;
  const tokenHash = hashApiToken(rawToken);
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });
  if (!token || !token.isActive) return null;
  if (token.expiresAt && token.expiresAt < new Date()) return null;
  if (!token.user.isActive) return null;

  await prisma.apiToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => null);

  return {
    id: token.user.id,
    email: token.user.email,
    role: token.user.role as AppRole,
    authType: "token" as const
  };
}

export async function requireAuth(req?: NextRequest) {
  const tokenUser = req ? await authViaApiToken(req) : null;
  if (tokenUser) {
    await purgeExpiredDeletedItems().catch(() => 0);
    return { user: tokenUser };
  }

  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }
  await purgeExpiredDeletedItems().catch(() => 0);
  return { user: { ...user, authType: "session" as const } } as const;
}

export async function requireWriteAccess(req?: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.user) return auth;
  if (auth.user.authType === "token") {
    return { error: NextResponse.json({ error: "API tokens are read-only" }, { status: 403 }) };
  }
  if (!canWrite(auth.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

export async function requireAdmin(req?: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.user) return auth;
  if (auth.user.authType === "token") {
    return { error: NextResponse.json({ error: "API tokens are read-only" }, { status: 403 }) };
  }
  if (auth.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

export async function locationScope(user: { id: string; role: string }) {
  return resolveAllowedLocationIds({ id: user.id, email: "", role: user.role as never });
}
