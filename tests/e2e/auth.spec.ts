import { expect, test } from "@playwright/test";

test.describe("authentication", () => {
  test("redirects protected pages to login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in or join" })).toBeVisible();
  });

  test("exposes magic-link and OAuth sign-in options", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /email me a secure link/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with apple/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /read the data notice/i })).toBeVisible();
  });

  test("privacy notice is public", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.getByRole("heading", { name: "ForeKingHell data notice" })).toBeVisible();
  });
});
