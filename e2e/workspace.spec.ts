import { expect, test } from "@playwright/test";

test("workspace entry renders the product identity and onboarding form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Threadline")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Everything in your business, in sync/i })).toBeVisible();
});
