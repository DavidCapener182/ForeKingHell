import { expect, test } from "@playwright/test";

test.skip(
  process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1",
  "Requires local authorised fixture session.",
);
test("G02/G03: collapsible sections and one search on both surfaces", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix.");
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  let fail = true;
  await page.route("**/api/desktop-workbench/commands*", async (route) => {
    if (fail) return route.fulfill({ status: 503, json: { items: [] } });
    return route.fulfill({
      json: {
        items:
          !new URL(route.request().url()).searchParams.get("q") ||
          /coastal|session/i.test(new URL(route.request().url()).searchParams.get("q")!)
            ? [
                {
                  title: "Coastal fixture session",
                  href: "/sessions/00000000-0000-4000-8000-000000000123",
                  detail:
                    "Authorised synthetic session with a long source description retained across both surfaces",
                  group: "Sessions",
                  keywords: "coastal fixture session",
                  type: "session",
                },
              ]
            : [],
      },
    });
  });
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=%2Ftoday`);
    await expect(page.locator("[data-command-centre-ready]")).toHaveAttribute(
      "data-command-centre-ready",
      "true",
    );
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
      { width: 360, height: 800 },
      { width: 1023, height: 800 },
      { width: 1024, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.keyboard.press("Control+k");
      const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
      await expect(dialog).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      if (fail) {
        await expect(dialog.getByRole("alert")).toContainText("could not be loaded");
        fail = false;
        await dialog.getByRole("button", { name: "Retry search" }).click();
      }
      const input = dialog.getByRole("combobox", { name: "Search command palette" });
      await input.fill("Coastal");
      await expect(dialog.getByRole("link", { name: /Coastal fixture session/ })).toBeVisible();
      await expect(dialog.getByRole("link", { name: /Coastal fixture session/ })).toHaveAttribute(
        "href",
        "/sessions/00000000-0000-4000-8000-000000000123",
      );
      await input.fill("sessions");
      const active = dialog.locator('[data-command-active="true"]');
      await input.press("Home");
      const first = await active.getAttribute("id");
      await input.press("ArrowDown");
      await expect(active).not.toHaveAttribute("id", first!);
      await input.press("ArrowUp");
      await expect(active).toHaveAttribute("id", first!);
      await input.fill("Coastal");
      await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeInViewport();
      await expect
        .poll(async () => {
          const bounds = await dialog.boundingBox();
          return Boolean(
            bounds &&
            bounds.y >= 0 &&
            bounds.x >= 0 &&
            bounds.y + bounds.height <= viewport.height + 1,
          );
        })
        .toBe(true);
      await page.screenshot({ path: info.outputPath(`G03-${surface}-${viewport.width}.png`) });
      await input.fill("No-such-fixture");
      await expect(dialog.getByText(/No matching command/)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
    await page.keyboard.press("Control+k");
    const navigationDialog = page.getByRole("dialog", { name: "Command palette", exact: true });
    const navigationInput = navigationDialog.getByRole("combobox", {
      name: "Search command palette",
    });
    await navigationInput.fill("handicap");
    await navigationInput.press("Home");
    await navigationInput.press("Enter");
    await expect(page).toHaveURL(/\/handicap(?:\?|$)/);
    await expect(navigationDialog).toBeHidden();
  }
  await page.goto("/surface/companion?next=%2Ftoday");
  await page.setViewportSize({ width: 360, height: 800 });
  const more = page.getByRole("button", { name: /Open more tools and profile/ });
  await more.click();
  const moreSearch = page.getByPlaceholder("Find a page or tool");
  for (const href of [
    "/rapsodo",
    "/achievements",
    "/feed",
    "/social-intelligence",
    "/analyse/session-impact",
  ]) {
    await expect(page.getByRole("dialog").locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await moreSearch.fill("recaps");
  await expect(page.getByRole("dialog").locator('a[href="/social-intelligence"]')).toBeVisible();
  await moreSearch.fill("No-such-fixture");
  await expect(page.getByRole("dialog").locator('a[href="/social-intelligence"]')).toHaveCount(0);
  await moreSearch.fill("");
  await page.getByRole("button", { name: "Search clubs, rounds and people" }).click();
  const palette = page.getByRole("dialog", { name: "Command palette", exact: true });
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/surface/workbench?next=%2Ftoday");
  const section = page.getByRole("button", { name: "Insights", exact: true });
  await expect(section).toHaveAttribute("aria-expanded", "true");
  await section.click();
  await expect(section).toHaveAttribute("aria-expanded", "false");
  await section.press("Enter");
  await expect(section).toHaveAttribute("aria-expanded", "true");
});
