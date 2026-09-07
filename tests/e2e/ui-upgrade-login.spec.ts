import { test, expect } from "@playwright/test";
test("Sign-in and join keep one heading, complete modes and safe return context", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultNavigationTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/login?mode=join&next=%2Fbilling%3Fsource%3Dfixture&reason=session_expired", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Sign in or join", level: 1, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Your session expired", { exact: true })).toBeVisible();
    await expect(page.getByText("/billing?source=fixture", { exact: true })).toBeVisible();
    expect(
      await page
        .locator('input[name="next"]')
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value)),
    ).toEqual(["/billing?source=fixture", "/billing?source=fixture", "/billing?source=fixture"]);
    await expect(page.getByRole("button", { name: "Show password", exact: true })).toBeEnabled({
      timeout: 60000,
    });
    await page
      .getByRole("textbox", { name: "Email", exact: true })
      .fill("synthetic@example.invalid");
    await page.locator("#password").fill("fixture-only-password");
    await page.getByRole("button", { name: "Show password", exact: true }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
    await expect(
      page.getByRole("button", { name: "Continue with Google", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Email for a secure link", exact: true }),
    ).toHaveAttribute("autocomplete", "email");
    await expect(page.getByRole("link", { name: "Read the data notice", exact: true })).toHaveCount(
      1,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`P84-login-${width}.png`) });
  }
  await page.goto(
    "/login?next=https%3A%2F%2Fexample.invalid%2Fbad&accountDeleted=1&receipt=synthetic",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.locator('input[name="next"]')).toHaveCount(0);
  await expect(page.getByText(/This return link alone does not confirm deletion/)).toBeVisible();
  await expect(page.getByText("Account permanently deleted", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
