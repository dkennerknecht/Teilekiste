import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email = "admin@local", password = "admin123") {
  await page.goto("/auth/signin");
  await page.getByPlaceholder("E-Mail").fill(email);
  await page.getByPlaceholder("Passwort").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/($|items|admin)/);
}
