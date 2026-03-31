import { expect, type Page } from "@playwright/test";
import { E2E_EMAIL_COOKIE, E2E_ROLE_COOKIE } from "@/lib/e2e-auth";

function resolveBaseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL || process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || "http://127.0.0.1:3000";
}

export async function login(page: Page, email = "admin@local") {
  const baseUrl = resolveBaseUrl();
  const maxAge = 30 * 24 * 60 * 60;

  await page.context().addCookies([
    {
      name: E2E_ROLE_COOKIE,
      value: "ADMIN",
      url: baseUrl,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + maxAge
    },
    {
      name: E2E_EMAIL_COOKIE,
      value: email,
      url: baseUrl,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + maxAge
    }
  ]);

  await expect(page.context().cookies(baseUrl)).resolves.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: E2E_ROLE_COOKIE }),
      expect.objectContaining({ name: E2E_EMAIL_COOKIE })
    ])
  );
}
