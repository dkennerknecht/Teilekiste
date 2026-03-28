import { expect, type Page } from "@playwright/test";
import * as nextAuthJwt from "next-auth/jwt";

const { encode } = nextAuthJwt as { encode: (params: { secret: string; maxAge: number; token: Record<string, unknown> }) => Promise<string> };

function resolveBaseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL || process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || "http://127.0.0.1:3000";
}

export async function login(page: Page, email = "admin@local") {
  const baseUrl = resolveBaseUrl();
  const secureCookie = baseUrl.startsWith("https://");
  const maxAge = 30 * 24 * 60 * 60;
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET || "playwright-secret",
    maxAge,
    token: {
      sub: "e2e-admin",
      email,
      name: "Admin",
      role: "ADMIN"
    }
  });

  await page.context().addCookies([
    {
      name: secureCookie ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      value: sessionToken,
      url: baseUrl,
      httpOnly: true,
      secure: secureCookie,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + maxAge
    }
  ]);

  await page.goto("/");
  await expect(page).toHaveURL(/\/($|items|admin)/);
}
