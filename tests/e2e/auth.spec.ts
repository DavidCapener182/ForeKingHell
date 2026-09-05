import { expect, test } from "@playwright/test";

test.describe("authentication", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("redirects protected pages to login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in or join" })).toBeVisible();
  });

  test("exposes magic-link and supported OAuth sign-in options", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /email me a secure link/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with apple/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /read the data notice/i })).toBeVisible();
  });

  test("keeps a dropped sign-in request in the form and permits retry", async ({ page }) => {
    await page.goto("/login");
    await page.route("**/login", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    await page.getByRole("button", { name: /sign in with password/i }).click();
    await expect(page.locator("#password-login-message")).toContainText("connection dropped");
    await expect(page.locator("[data-route-error-state]")).toHaveCount(0);
    await page.unroute("**/login");
    await page.getByRole("button", { name: /sign in with password/i }).click();
    await expect(page.locator("#password-login-message")).toContainText(
      /Enter your email and password|Supabase Auth is not configured/i,
    );
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

  test("recovers from a corrupted Supabase refresh cookie", async ({ context, page }) => {
    test.skip(
      process.env.PLAYWRIGHT_LIVE_SUPABASE_AUTH !== "1",
      "Requires the disposable live Supabase auth project.",
    );
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for this test.");
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

    await context.addCookies([
      {
        name: `sb-${projectRef}-auth-token`,
        value: JSON.stringify({
          access_token: "expired",
          refresh_token: "deliberately-corrupted-refresh-token",
          expires_at: 1,
        }),
        url: test.info().project.use.baseURL as string,
      },
      {
        name: `sb-${projectRef}-auth-token-code-verifier`,
        value: "stale-pkce-verifier",
        url: test.info().project.use.baseURL as string,
      },
    ]);

    await page.goto("/dashboard?from=expired-cookie");

    await expect(page).toHaveURL(
      /\/login\?reason=session_expired&next=%2Fdashboard%3Ffrom%3Dexpired-cookie/,
    );
    await expect(page.getByText("Your session expired", { exact: true })).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.some((cookie) => cookie.name.startsWith(`sb-${projectRef}-auth-token`))).toBe(
      false,
    );
  });
});

test.describe("native sign-in fallback", () => {
  test.use({ javaScriptEnabled: false, storageState: { cookies: [], origins: [] } });

  test("retains native POST forms and submits without JavaScript", async ({ page }) => {
    await page.goto("/login");
    const forms = page.locator("form");
    await expect(forms).toHaveCount(3);
    for (const form of await forms.all()) {
      await expect(form).toHaveAttribute("method", "POST");
      await expect(form).not.toHaveAttribute("action", /javascript:/);
      expect(await form.locator('input[name^="$ACTION_"]').count()).toBeGreaterThan(0);
    }
    await page.getByRole("button", { name: /sign in with password/i }).click();
    await expect(page.locator("#password-login-message")).toContainText(
      /Enter your email and password|Supabase Auth is not configured/i,
    );
  });
});
