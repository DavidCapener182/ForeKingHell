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

  test("shows a visible password sign-in failure message", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("not-a-real-player@example.com");
    await page.getByLabel("Password").fill("wrong-password-for-test");
    await page.getByRole("button", { name: /sign in with password/i }).click();

    const passwordMessage = page.locator("#password-login-message");

    await expect(passwordMessage).toBeVisible();
    await expect(passwordMessage).toHaveAttribute("role", "alert");
    await expect(passwordMessage).toContainText(
      /Invalid login credentials|Supabase Auth is not configured|Sign-in could not reach the auth service/i,
    );
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("uses app error messaging instead of browser validation for short passwords", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("not-a-real-player@example.com");
    await page.getByLabel("Password").fill("x");
    await page.getByRole("button", { name: /sign in with password/i }).click();

    const passwordMessage = page.locator("#password-login-message");

    await expect(passwordMessage).toBeVisible();
    await expect(passwordMessage).toHaveAttribute("role", "alert");
    await expect(passwordMessage).toContainText(
      /Invalid login credentials|Supabase Auth is not configured|Sign-in could not reach the auth service/i,
    );
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });

  test("privacy notice is public", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.getByRole("heading", { name: "LM World Tour data notice" })).toBeVisible();
  });
});
