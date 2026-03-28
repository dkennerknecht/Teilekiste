import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin can create an item and inspect audit history", async ({ page }) => {
  await login(page);

  const itemName = `E2E Item ${Date.now()}`;
  await page.goto("/items/new");
  await page.getByLabel("Name").fill(itemName);
  await page.getByLabel("Hersteller").fill("OpenAI Labs");
  await page.getByLabel("MPN").fill(`E2E-${Date.now()}`);
  await page.getByRole("spinbutton", { name: /^Bestand$/ }).fill("4");
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page).toHaveURL(/\/items\/.+/);
  await expect(page.getByText(itemName)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Audit History" })).toBeVisible();
  await expect(page.getByText("Item angelegt")).toBeVisible();

  await page.goto("/admin/audit");
  await page.getByPlaceholder("Suche nach Aktion, User, Item oder ID").fill(itemName);
  await expect(page.getByText("Item angelegt")).toBeVisible();
});

test("anonymous users are blocked from admin pages", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\/signin/);
});
