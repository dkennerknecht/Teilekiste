import type { NextRequest } from "next/server";

export const E2E_ROLE_COOKIE = "codex-e2e-role";
export const E2E_EMAIL_COOKIE = "codex-e2e-email";

export type E2eAuthRole = "ADMIN" | "READ_WRITE" | "READ";

export function isE2eAuthBypassEnabled() {
  return process.env.E2E_AUTH_BYPASS === "1";
}

export function parseE2eAuthRole(value?: string | null): E2eAuthRole | null {
  if (value === "ADMIN" || value === "READ_WRITE" || value === "READ") return value;
  return null;
}

export function readE2eBypassRoleFromRequest(req: Pick<NextRequest, "cookies">) {
  if (!isE2eAuthBypassEnabled()) return null;
  return parseE2eAuthRole(req.cookies.get(E2E_ROLE_COOKIE)?.value);
}
