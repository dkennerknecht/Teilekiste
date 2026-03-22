export type AppRole = "ADMIN" | "READ_WRITE" | "READ";

export type SessionUser = {
  id: string;
  email: string;
  role: AppRole;
};

export function canWrite(role: AppRole) {
  return role === "ADMIN" || role === "READ_WRITE";
}

export function requireRole(role: AppRole, required: AppRole[]) {
  if (!required.includes(role)) {
    throw new Error("FORBIDDEN");
  }
}

import { prisma } from "@/lib/prisma";

export async function resolveAllowedLocationIds(user: SessionUser) {
  if (user.role === "ADMIN") return null;
  const scopes = await prisma.userLocation.findMany({ where: { userId: user.id } });
  if (!scopes.length) return [];
  return scopes.map((scope) => scope.storageLocationId);
}
