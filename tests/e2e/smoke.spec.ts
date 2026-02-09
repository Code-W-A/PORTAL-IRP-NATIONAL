import { expect, test } from "@playwright/test";

test("login page renders core fields", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Autentificare" })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /Intră|Autentificare/ })).toBeVisible();
});

test("reset password page renders core fields", async ({ page }) => {
  await page.goto("/reset-password");

  await expect(page.getByRole("heading", { name: "Resetare parolă" })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Trimite link" })).toBeVisible();
});
