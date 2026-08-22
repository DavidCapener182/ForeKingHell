import { expect, test, type Request } from "@playwright/test";

import { authStorageState, hasAuthenticatedE2e, hasLocalAuthBypass } from "./helpers";

test.describe("shot review controls", () => {
  if (!hasLocalAuthBypass && authStorageState) {
    test.use({ storageState: authStorageState });
  }
  test.skip(
    !hasAuthenticatedE2e,
    "Enable the local Playwright auth bypass or provide an auth state for shot review checks.",
  );

  test("bulk Exclude confirmation emits one intercepted Next-Action POST", async ({ page }) => {
    const nextActionPosts: Request[] = [];

    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "POST" && url.pathname === "/shots") {
        if (request.headers()["next-action"]) {
          nextActionPosts.push(request);
        }

        await route.abort("blockedbyclient");
        return;
      }

      await route.fallback();
    });

    await page.goto("/shots", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Shot Explorer" })).toBeVisible();

    const firstShotCheckbox = page.getByRole("checkbox", { name: /^Select .+ shot .+$/ }).first();
    if ((await firstShotCheckbox.count()) === 0) {
      await page.reload({ waitUntil: "commit" });
      await expect(page.getByRole("heading", { name: "Shot Explorer" })).toBeVisible();
    }
    test.skip(
      (await firstShotCheckbox.count()) === 0,
      "The bypass account has no shots to review.",
    );

    await firstShotCheckbox.click();
    const selectedActions = page.getByRole("toolbar", { name: "Selected shot actions" });
    await expect(selectedActions).toBeVisible();
    await selectedActions.getByRole("button", { name: "Exclude selected" }).click();

    const dialog = page.getByRole("alertdialog", { name: /Exclude 1 selected shots?\?/ });
    await expect(dialog).toBeVisible();
    const confirm = dialog.locator("button[data-shot-review-confirm]");
    await expect(confirm).toHaveAttribute("data-slot", "button");
    await expect(confirm).toHaveAttribute("type", "button");
    await expect(confirm).toHaveAccessibleName("Exclude selected");

    await confirm.click();

    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(nextActionPosts).toHaveLength(1);
    expect(new URL(nextActionPosts[0].url()).pathname).toBe("/shots");
    expect(nextActionPosts[0].method()).toBe("POST");
    expect(nextActionPosts[0].headers()["next-action"]).toBeTruthy();
  });

  test("bulk permanent Delete is visible and keeps a failed POST inside its confirmation", async ({
    page,
  }) => {
    const nextActionPosts: Request[] = [];

    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "POST" && url.pathname === "/shots") {
        if (request.headers()["next-action"]) nextActionPosts.push(request);
        await route.abort("blockedbyclient");
        return;
      }

      await route.fallback();
    });

    await page.goto("/shots", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Shot Explorer" })).toBeVisible();

    const firstShotCheckbox = page.getByRole("checkbox", { name: /^Select .+ shot .+$/ }).first();
    test.skip(
      (await firstShotCheckbox.count()) === 0,
      "The bypass account has no shots to delete.",
    );

    await firstShotCheckbox.click();
    const toolbar = page.getByRole("toolbar", { name: "Selected shot actions" });
    const deleteSelected = toolbar.getByRole("button", { name: "Delete selected" });
    await expect(deleteSelected).toBeVisible();
    test.skip(
      await deleteSelected.isDisabled(),
      "The first bypass-account shot is course-managed and cannot be deleted from Shot Explorer.",
    );

    await deleteSelected.click();
    const dialog = page.getByRole("alertdialog", { name: "Permanently delete this shot?" });
    await expect(dialog).toContainText("This cannot be undone.");
    await expect(dialog).toContainText("original import file and raw import rows remain");

    const confirm = dialog.locator("button[data-shot-delete-confirm]");
    await expect(confirm).toHaveAccessibleName("Permanently delete");
    await confirm.click();

    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(nextActionPosts).toHaveLength(1);
    expect(nextActionPosts[0].headers()["next-action"]).toBeTruthy();
  });

  test("single-row menu exposes permanent Delete without mutating data", async ({ page }) => {
    const nextActionPosts: Request[] = [];

    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === "POST" && url.pathname === "/shots") {
        if (request.headers()["next-action"]) nextActionPosts.push(request);
        await route.abort("blockedbyclient");
        return;
      }

      await route.fallback();
    });

    await page.goto("/shots", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Shot Explorer" })).toBeVisible();

    const firstActions = page.getByRole("button", { name: /^Actions for .+ shot .+$/ }).first();
    test.skip((await firstActions.count()) === 0, "The bypass account has no shot-row menu.");
    await firstActions.click();

    const deleteMenuItem = page.getByRole("menuitem", { name: "Delete permanently" });
    test.skip(
      (await deleteMenuItem.count()) === 0,
      "The first bypass-account shot is course-managed and only offers Exclude from stats here.",
    );
    await deleteMenuItem.click();

    const dialog = page.getByRole("alertdialog", { name: "Permanently delete this shot?" });
    await expect(dialog).toBeVisible();
    await dialog.locator("button[data-shot-delete-confirm]").click();

    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(nextActionPosts).toHaveLength(1);
    expect(nextActionPosts[0].method()).toBe("POST");
  });
});
