import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin can create an item and inspect audit history", async ({ page }) => {
  await login(page);

  const itemName = `E2E Item ${Date.now()}`;
  await page.goto("/items/new", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Name").fill(itemName);
  await page.getByLabel(/^(Hersteller|Manufacturer)$/).fill("OpenAI Labs");
  await page.getByLabel("MPN").fill(`E2E-${Date.now()}`);
  const locationSelect = page.locator("label", { hasText: /Lagerort|Storage location/ }).locator("select");
  const shelfSelect = page.locator("label", { hasText: /Regal \/ Bereich|Shelf \/ area/ }).locator("select");
  await locationSelect.selectOption({ index: 1 });
  await expect(shelfSelect).toBeEnabled();
  await shelfSelect.selectOption({ index: 1 });
  await page.getByRole("spinbutton", { name: /^(Bestand|Stock)\b/ }).fill("4");
  await page.getByRole("button", { name: /^(Speichern|Save)$/ }).click();

  await expect(page).toHaveURL(/\/items\/.+/);
  await expect(page.getByRole("heading", { level: 1, name: itemName })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^(Audit-Historie|Audit History)$/ })).toBeVisible();
  await expect(page.getByText(/^(Item angelegt|Item created)$/)).toBeVisible();

  await page.goto("/admin/audit", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/^(Suche nach Aktion, User, Item oder ID|Search action, user, item, or ID)$/).fill(itemName);
  await expect(page.getByText(/^(Item angelegt|Item created)$/)).toBeVisible();
});

test("anonymous users are blocked from admin pages", async ({ page }) => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/auth\/signin/);
});
