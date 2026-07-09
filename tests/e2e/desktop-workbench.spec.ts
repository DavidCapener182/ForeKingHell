import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

import { authStorageState, expectPageReady } from "./helpers";

const hasAuthBypass = process.env.PLAYWRIGHT_E2E_AUTH_BYPASS === "1";
const useAuthStorage = Boolean(authStorageState) && !hasAuthBypass;
const baseUrl = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100");
const authUserId = authStorageState ? extractSupabaseUserId(authStorageState) : null;
const desktopMatrixViewports = [
  { name: "desktop-1024x768", width: 1024, height: 768 },
  { name: "desktop-1280x720", width: 1280, height: 720 },
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-2560x1440", width: 2560, height: 1440 },
] as const;
const desktopMatrixRoutes = [
  { path: "/dashboard", ready: /Quick answers|Dashboard/i },
  { path: "/today", ready: /Best performer|Practice score/i },
  { path: "/shots", ready: /Shot explorer/i },
  { path: "/bag", ready: /AI bag rail|Bag/i },
  { path: "/speed", ready: /Speed Centre/i },
  { path: "/strokes-gained", ready: /AI strokes-gained rail|Strokes gained/i },
  { path: "/rounds?filter=scorecard-only", ready: /Round history|Rounds/i },
  { path: "/leaderboard?tab=monthly&sort=monthly-shots&dir=desc", ready: /Leaderboard/i },
  { path: "/data-chat", ready: /AI data rail|Ask ForeKingHell/i },
] as const;

test.describe("desktop workbench", () => {
  test.use(
    useAuthStorage
      ? { storageState: authStorageState, acceptDownloads: true }
      : {
          acceptDownloads: true,
        },
  );
  test.setTimeout(90_000);

  test.beforeEach(async ({ context }) => {
    if (!hasAuthBypass || useAuthStorage) {
      return;
    }

    await context.addCookies([createPlaywrightBypassCookie()]);
  });

  test("command palette supports desktop route switching", async ({ page }) => {
    skipWhenNoDesktopAuth();
    const hydrationWarnings = collectHydrationWarnings(page);

    await page.route("**/api/desktop-workbench/commands", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Dashboard|Today/i);

    await page.keyboard.press("ControlOrMeta+K");
    await expect(page.getByRole("dialog", { name: /command palette/i })).toBeVisible();
    await page.getByPlaceholder(/search driver/i).fill("shots");
    await page.getByRole("link", { name: /Shots/i }).first().click();

    await expect(page).toHaveURL(/\/shots/);
    await expectPageReady(page, /Shot explorer/i);

    await page.keyboard.press("ControlOrMeta+K");
    const commandDialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(commandDialog).toBeVisible();
    await page.getByPlaceholder(/search driver/i).fill("add round");
    await expect(commandDialog.locator("[data-command-active='true']")).toContainText("Add round");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/rounds\/new/);
    expect(hydrationWarnings).toEqual([]);
  });

  test("command palette searches workspace clubs, rounds, courses and friends", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.route("**/api/desktop-workbench/commands", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              title: "8i - Mizuno JPX",
              href: "/bag/club-8i/analytics",
              detail: "8i analytics - current bag position 9",
              group: "Club",
              keywords: "8i eight iron Mizuno JPX approach carry dispersion",
              type: "club",
            },
            {
              title: "Round - Winter Stableford",
              href: "/rounds/round-winter",
              detail: "05 Jul 2026 - Real Round evidence",
              group: "Round",
              keywords: "winter stableford round scorecard handicap",
              type: "round",
            },
            {
              title: "Aintree Golf Centre",
              href: "/courses/course-aintree/records",
              detail: "England - public course",
              group: "Course",
              keywords: "Aintree Golf Centre course records holes map",
              type: "course",
            },
            {
              title: "Session - Range tune-up",
              href: "/today?session=session-range",
              detail: "06 Jul 2026 - Range evidence",
              group: "Session",
              keywords: "Range tune-up practice session import review",
              type: "session",
            },
            {
              title: "Alex Smith",
              href: "/profile/alex-smith",
              detail: "@alex-smith - friend profile",
              group: "Friend",
              keywords: "Alex Smith friend profile compare",
              type: "friend",
            },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    await page.keyboard.press("ControlOrMeta+K");
    const search = page.getByPlaceholder(/Search driver/i);
    await expect(search).toBeFocused();

    await search.fill("Aintree");
    await expect(page.getByRole("link", { name: /Aintree Golf Centre/i })).toHaveAttribute(
      "href",
      "/courses/course-aintree/records",
    );

    await search.fill("8i Mizuno");
    await expect(page.getByRole("link", { name: /8i - Mizuno JPX/i })).toHaveAttribute(
      "href",
      "/bag/club-8i/analytics",
    );

    await search.fill("Winter Stableford");
    await expect(page.getByRole("link", { name: /Round - Winter Stableford/i })).toHaveAttribute(
      "href",
      "/rounds/round-winter",
    );

    await search.fill("Range tune-up");
    await expect(page.getByRole("link", { name: /Session - Range tune-up/i })).toHaveAttribute(
      "href",
      "/today?session=session-range",
    );

    await search.fill("Alex Smith");
    await expect(page.getByRole("link", { name: /Alex Smith/i })).toHaveAttribute(
      "href",
      "/profile/alex-smith",
    );
  });

  test("command palette searches saved table views", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    await page.evaluate(() => {
      window.localStorage.setItem(
        "fkh:saved-views:shots",
        JSON.stringify([
          {
            id: "saved-driver-carry",
            title: "Driver carry audit",
            href: "/shots?sort=carry",
            detail: "07 Jul 2026",
            createdAt: "2026-07-07T00:00:00.000Z",
            density: "compact",
            visibleColumnIds: ["date", "file", "shot", "club", "carry"],
          },
        ]),
      );
    });

    await page.keyboard.press("ControlOrMeta+K");

    const commandDialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(commandDialog.locator("aside").getByText(/Saved table views/i)).toBeVisible();
    await expect(
      commandDialog.locator("aside").getByRole("link", { name: /Driver carry audit/i }),
    ).toHaveAttribute("href", "/shots?sort=carry");

    await page.getByPlaceholder(/Search driver/i).fill("Driver carry audit");
    const savedViewResult = commandDialog
      .locator("[data-command-results]")
      .getByRole("link", { name: /Driver carry audit/i });

    await expect(savedViewResult).toHaveAttribute("href", "/shots?sort=carry");
    await savedViewResult.click();

    await expect(page).toHaveURL(/\/shots\?sort=carry/);
    await expectPageReady(page, /Shot explorer/i);
  });

  test("command palette recent items preserve selected workspace object labels", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.route("**/api/desktop-workbench/commands", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              title: "Aintree Golf Centre",
              href: "/dashboard?recent=aintree",
              detail: "England - public course",
              group: "Course",
              keywords: "Aintree Golf Centre course records holes map",
              type: "course",
            },
            {
              title: "Alex Smith",
              href: "/dashboard?recent=alex",
              detail: "@alex-smith - friend profile",
              group: "Friend",
              keywords: "Alex Smith friend profile compare",
              type: "friend",
            },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);
    await page.evaluate(() => window.localStorage.removeItem("fkh:desktop-recent-items"));

    await page.keyboard.press("ControlOrMeta+K");
    await page.getByPlaceholder(/Search driver/i).fill("Aintree");
    await page
      .getByRole("link", { name: /Aintree Golf Centre/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard\?recent=aintree/);

    await page.keyboard.press("ControlOrMeta+K");
    const recentItems = page.getByRole("dialog", { name: /command palette/i }).locator("aside");
    await expect(recentItems.getByRole("link", { name: /Aintree Golf Centre/i })).toBeVisible();
    await expect(recentItems.getByRole("link", { name: /Aintree Golf Centre/i })).toHaveAttribute(
      "href",
      "/dashboard?recent=aintree",
    );
  });

  test("top bar workspace links expose pinned, saved and recent workspaces", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.addInitScript(() => {
      window.localStorage.setItem(
        "fkh:desktop-pinned-items",
        JSON.stringify([
          {
            title: "Aintree records",
            href: "/courses/course-aintree/records",
            detail: "Course record workspace",
            group: "Course",
          },
        ]),
      );
      window.localStorage.setItem(
        "fkh:desktop-recent-items",
        JSON.stringify([
          {
            title: "Alex Smith",
            href: "/profile/alex-smith",
            detail: "Friend profile",
            group: "Friend",
          },
        ]),
      );
      window.localStorage.setItem(
        "fkh:saved-views:shots",
        JSON.stringify([
          {
            id: "driver-carry-audit",
            title: "Driver carry audit",
            href: "/shots?sort=carry",
            detail: "07 Jul 2026",
            createdAt: "2026-07-07T00:00:00.000Z",
          },
        ]),
      );
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    await page.getByRole("button", { name: /Open workspace links/i }).click();
    const workspaceMenu = page.getByRole("menu");

    await expect(workspaceMenu.getByText("Pinned workspace")).toBeVisible();
    await expect(workspaceMenu.getByRole("link", { name: /Aintree records/i })).toHaveAttribute(
      "href",
      "/courses/course-aintree/records",
    );
    await expect(workspaceMenu.getByRole("link", { name: /Driver carry audit/i })).toHaveAttribute(
      "href",
      "/shots?sort=carry",
    );
    await expect(workspaceMenu.getByRole("link", { name: /Alex Smith/i })).toHaveAttribute(
      "href",
      "/profile/alex-smith",
    );

    await page.keyboard.press("Escape");
    await page.keyboard.press("w");
    await expect(
      page.getByRole("menu").getByRole("link", { name: /Aintree records/i }),
    ).toBeVisible();

    await workspaceMenu.getByRole("menuitem", { name: /Pin current workspace/i }).click();
    await page.getByRole("button", { name: /Open workspace links/i }).click();
    await expect(page.getByRole("menu").getByRole("link", { name: /^Dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  test("command palette pins and unpins workspace results", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.route("**/api/desktop-workbench/commands", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              title: "Aintree Golf Centre",
              href: "/courses/course-aintree/records",
              detail: "England - public course",
              group: "Course",
              keywords: "Aintree Golf Centre course records holes map",
              type: "course",
            },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);
    await page.evaluate(() => window.localStorage.removeItem("fkh:desktop-pinned-items"));

    await page.keyboard.press("ControlOrMeta+K");
    const commandDialog = page.getByRole("dialog", { name: /command palette/i });
    const pinnedWorkspace = commandDialog.locator("aside");

    await page.getByPlaceholder(/Search driver/i).fill("Aintree");
    await commandDialog.getByRole("button", { name: /Pin Aintree Golf Centre/i }).click();

    await expect(
      pinnedWorkspace.getByRole("link", { name: /Aintree Golf Centre/i }),
    ).toHaveAttribute("href", "/courses/course-aintree/records");

    await commandDialog.getByRole("button", { name: /Unpin Aintree Golf Centre/i }).click();
    await expect(pinnedWorkspace.getByRole("link", { name: /Aintree Golf Centre/i })).toHaveCount(
      0,
    );
  });

  test("notification centre shows workspace alerts and action links", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.addInitScript(() => {
      if (window.sessionStorage.getItem("fkh:e2e-notification-storage-ready") !== "1") {
        window.localStorage.removeItem("fkh:desktop-notification-read-ids");
        window.sessionStorage.setItem("fkh:e2e-notification-storage-ready", "1");
      }
    });

    await page.route("**/api/desktop-workbench/notifications", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "friend-1",
              title: "Alex Smith sent a friend request",
              detail: "Review the request from Friends.",
              href: "/friends",
              tone: "blue",
              unread: true,
            },
            {
              id: "challenge-1",
              title: "Challenge invite: July Driver Ladder",
              detail: "Sam invited you to join.",
              href: "/challenges/challenge-1",
              tone: "amber",
              unread: true,
            },
            {
              id: "import-1",
              title: "Import Saved: range.csv",
              detail: "Range evidence saved 06 Jul.",
              href: "/import",
              tone: "green",
              unread: false,
            },
            {
              id: "data-warning-1",
              title: "Duplicate import warning",
              detail: "range-copy.csv matched an earlier file.",
              href: "/import",
              tone: "amber",
              unread: true,
            },
            {
              id: "achievement-1",
              title: "Achievement unlocked: First Import",
              detail: "+100 XP - 06 Jul.",
              href: "/achievements?achievement=first_import#achievement-first_import",
              tone: "green",
              unread: false,
            },
          ],
        }),
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    await page.getByRole("button", { name: /Open notifications/i }).click();
    await expect(page.getByText("3 unread")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Alex Smith sent a friend request/i }),
    ).toHaveAttribute("href", "/friends");
    await expect(
      page.getByRole("link", { name: /Challenge invite: July Driver Ladder/i }),
    ).toHaveAttribute("href", "/challenges/challenge-1");
    await expect(page.getByRole("link", { name: /Duplicate import warning/i })).toHaveAttribute(
      "href",
      "/import",
    );
    await expect(
      page.getByRole("link", { name: /Achievement unlocked: First Import/i }),
    ).toHaveAttribute("href", "/achievements?achievement=first_import#achievement-first_import");

    await page
      .getByRole("button", { name: /Mark read/i })
      .first()
      .click();
    await expect(page.getByText("2 unread")).toBeVisible();

    await page.reload();
    await expectPageReady(page, /Quick answers/i);
    await page.getByRole("button", { name: /Open notifications/i }).click();
    await expect(page.getByText("2 unread")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Alex Smith sent a friend request/i }).locator("xpath=.."),
    ).toContainText("Read");

    await page.getByRole("button", { name: /Mark all read/i }).click();
    await expect(page.getByText("All clear")).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark read/i })).toHaveCount(0);
  });

  test("desktop keyboard shortcuts route, focus, export and open AI tools", async ({ page }) => {
    skipWhenNoDesktopAuth();
    const hydrationWarnings = collectHydrationWarnings(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: /Keyboard shortcuts/i })).toBeVisible();
    await expect(page.getByText(/Export current view/i)).toBeVisible();
    await expect(page.getByText(/Open workspace links/i)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("g");
    await page.keyboard.press("s");
    await expect(page).toHaveURL(/\/shots/);
    await expectPageReady(page, /Shot explorer/i);
    await expect(page.locator("[data-page-search]").first()).toBeVisible();

    await page.keyboard.press("/");
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.hasAttribute("data-page-search") ?? false),
      )
      .toBe(true);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("f");
    await expect(page.getByRole("button", { name: /Saved views/i })).toBeFocused();

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("e")]);
    expect(download.suggestedFilename()).toBe("forekinghell-shots-view.csv");

    await page.keyboard.press("a");
    await expect(page.getByRole("dialog", { name: /Shots assistant/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Explain this page/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("g");
    await page.keyboard.press("d");
    await expect(page).toHaveURL(/\/dashboard/);
    await expectPageReady(page, /Quick answers/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Dashboard/i }),
    ).toBeVisible();
    expect(hydrationWarnings).toEqual([]);
  });

  test("AI assistant saved insights appear in the command palette rail", async ({ page }) => {
    skipWhenNoDesktopAuth();
    const hydrationWarnings = collectHydrationWarnings(page);

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/shots");
    await expectPageReady(page, /Shot explorer/i);
    await page.evaluate(() => window.localStorage.removeItem("fkh:desktop-saved-insights"));
    await page.reload();
    await expectPageReady(page, /Shot explorer/i);

    await page.keyboard.press("a");
    const assistantDialog = page.getByRole("dialog", { name: /Shots assistant/i });
    await expect(assistantDialog).toBeVisible();
    await assistantDialog.getByRole("button", { name: /Save this insight/i }).click();
    await expect(assistantDialog.getByRole("button", { name: /Insight saved/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("ControlOrMeta+K");
    const commandDialog = page.getByRole("dialog", { name: /command palette/i });
    const savedInsights = commandDialog.locator("aside");
    await expect(savedInsights.getByText(/Saved insights/i)).toBeVisible();
    await expect(savedInsights.getByRole("link", { name: /Shots insight/i })).toHaveAttribute(
      "href",
      "/shots",
    );
    await page.keyboard.press("Escape");

    await page.reload();
    await expectPageReady(page, /Shot explorer/i);
    await page.keyboard.press("ControlOrMeta+K");
    await expect(
      page
        .getByRole("dialog", { name: /command palette/i })
        .locator("aside")
        .getByRole("link", { name: /Shots insight/i }),
    ).toHaveAttribute("href", "/shots");
    expect(hydrationWarnings).toEqual([]);
  });

  test("AI rail saved insights appear in the command palette rail", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 2200, height: 1100 });
    await gotoAppRoute(page, "/coach");
    await expectPageReady(page, /AI coach rail/i);
    await page.evaluate(() => window.localStorage.removeItem("fkh:desktop-saved-insights"));
    await page.reload({ waitUntil: "commit" });
    await expectAppText(page, /AI coach rail/i, 45_000);

    const rail = page.getByRole("complementary", { name: /AI coach rail/i });
    await rail.getByRole("button", { name: /Save this insight/i }).click();
    await expect(rail.getByRole("button", { name: /Insight saved/i })).toBeVisible();

    await page.keyboard.press("ControlOrMeta+K");
    const commandDialog = page.getByRole("dialog", { name: /command palette/i });
    await expect(commandDialog.locator("aside").getByText(/Saved insights/i)).toBeVisible();
    await expect(
      commandDialog.locator("aside").getByRole("link", { name: /AI coach rail insight/i }),
    ).toHaveAttribute("href", "/coach");
  });

  test("desktop top bar exposes account and platform shortcuts", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    await page.getByRole("button", { name: /Open desktop account menu/i }).click();
    await expect(page.getByRole("menuitem", { name: /^Profile$/i })).toHaveAttribute(
      "href",
      "/profile",
    );
    await expect(page.getByRole("menuitem", { name: /^Settings$/i })).toHaveAttribute(
      "href",
      "/settings",
    );
    await expect(page.getByRole("menuitem", { name: /^Billing$/i })).toHaveAttribute(
      "href",
      "/billing",
    );
    await expect(page.getByRole("menuitem", { name: /Achievements/i })).toBeVisible();
  });

  test("workspace switcher routes between player, coach and admin views", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    const switcher = page.getByRole("button", { name: /Switch workspace view/i });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText("Player workspace");

    await switcher.click();
    await expect(page.getByRole("menuitem", { name: /Coach desk/i })).toBeVisible();
    const adminOption = page.getByRole("menuitem", { name: /Admin console/i });
    const hasAdminWorkspace = (await adminOption.count()) > 0;
    await page.getByRole("menuitem", { name: /Coach desk/i }).click();

    await expect(page).toHaveURL(/\/coach/);
    await expectPageReady(page, /AI coach rail/i);
    await expect(switcher).toContainText("Coach desk");

    await switcher.click();
    await page.getByRole("menuitem", { name: /Player workspace/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expectPageReady(page, /Quick answers/i);
    await expect(switcher).toContainText("Player workspace");

    await switcher.click();
    if (hasAdminWorkspace) {
      await page.getByRole("menuitem", { name: /Admin console/i }).click();
      await expect(page).toHaveURL(/\/admin/);
      await expectPageReady(page, /Operating pages|Admin/i);
      await expectNoAiRail(page, /AI admin rail/i);
      await expect(switcher).toContainText("Admin console");

      await page.setViewportSize({ width: 2048, height: 1100 });
      await gotoAppRoute(page, "/admin");
      await expectPageReady(page, /AI admin rail/i);
      await expect(page.getByRole("complementary", { name: /AI admin rail/i })).toBeVisible();
    } else {
      await expect(page.getByRole("menuitem", { name: /Admin console/i })).toHaveCount(0);
    }
  });

  test("main table skip link targets declared desktop data tables", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);
    await expect(page.getByRole("button", { name: /Skip to main table/i })).toHaveCount(0);

    await gotoAppRoute(page, "/shots");
    await expectPageReady(page, /Shot explorer/i);

    const skipToMainTable = page.getByRole("button", { name: /Skip to main table/i });
    const mainTableTarget = page.locator("[data-main-table-target='true']");

    await expect(mainTableTarget).toHaveAttribute("aria-label", "Shot explorer table");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /Skip to content/i })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /Skip to sidebar/i })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(skipToMainTable).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(mainTableTarget).toBeFocused();

    await gotoAppRoute(page, "/rounds");
    await expectPageReady(page, /Round history/i);
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Round history table",
    );

    await gotoAppRoute(page, "/bag");
    await expectPageReady(page, /Bag|Gapping/i);
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Full bag gapping table",
    );
  });

  test("workbench table rows support arrow, home and end keyboard navigation", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAppRoute(page, "/shots");
    await expectPageReady(page, /Shot explorer/i);
    await expectWorkbenchRowKeyboardNavigation(page, 'table[data-workbench-export-table="shots"]');

    await gotoAppRoute(page, "/admin/users");
    await expectAppText(page, /Users and access/i, 45_000);
    await expectWorkbenchRowKeyboardNavigation(
      page,
      'table[data-workbench-export-table="admin-users"]',
    );
  });

  test("workbench table rows activate with enter and space", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    await page.evaluate(() => {
      const table = document.createElement("table");
      table.setAttribute("data-workbench-export-table", "keyboard-activation");
      table.innerHTML = `
        <tbody>
          <tr tabindex="0" data-activated="0">
            <td>Keyboard activation row</td>
          </tr>
        </tbody>
      `;

      const row = table.querySelector("tr");
      row?.addEventListener("click", () => {
        const count = Number(row.getAttribute("data-activated") ?? "0");
        row.setAttribute("data-activated", String(count + 1));
      });
      document.body.append(table);
    });

    const row = page.locator('table[data-workbench-export-table="keyboard-activation"] tbody tr');

    await row.focus();
    await page.keyboard.press("Enter");
    await expect(row).toHaveAttribute("data-activated", "1");

    await page.keyboard.press("Space");
    await expect(row).toHaveAttribute("data-activated", "2");
  });

  test("sidebar density modes support compact and icon-only desktop navigation", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    const sidebarShell = page.locator("[data-sidebar-density]");

    await expect(sidebarShell).toHaveAttribute("data-sidebar-density", "comfortable");
    await page.getByRole("button", { name: /Sidebar density/i }).click();
    await page.getByRole("menuitemradio", { name: /Compact/i }).click();
    await expect(sidebarShell).toHaveAttribute("data-sidebar-density", "compact");
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("fkh:desktop-sidebar-density")))
      .toBe("compact");

    await page.reload({ waitUntil: "commit" });
    await expectAppText(page, /Quick answers/i, 45_000);
    await expect(page.locator("[data-sidebar-density]")).toHaveAttribute(
      "data-sidebar-density",
      "compact",
    );

    await page.getByRole("button", { name: /Sidebar density/i }).click();
    await page.getByRole("menuitemradio", { name: /Icon-only/i }).click();
    await expect(page.locator("[data-sidebar-density]")).toHaveAttribute(
      "data-sidebar-density",
      "icon",
    );

    await page.getByRole("button", { name: /Sidebar density/i }).click();
    await page.getByRole("menuitemradio", { name: /Comfortable/i }).click();
    await expect(page.locator("[data-sidebar-density]")).toHaveAttribute(
      "data-sidebar-density",
      "comfortable",
    );
  });

  test("dashboard layout controls support modes, hidden panels and reset", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAppRoute(page, "/dashboard");
    await expectPageReady(page, /Quick answers/i);

    const controls = page.locator("[data-dashboard-layout-controls]");
    const grid = page.locator("[data-dashboard-bento-grid]");
    const playsLikePanel = page.locator('[data-dashboard-panel="plays-like"]');
    const playsLikeControls = page.locator('[data-dashboard-panel-control="plays-like"]');

    await expect(controls).toBeVisible();
    await controls.getByRole("button", { name: /Reset/i }).click();
    await expect(grid).toHaveAttribute("data-dashboard-mode", "standard");
    await expect(playsLikePanel).toBeVisible();

    await controls.getByRole("button", { name: /Executive/i }).click();
    await expect(grid).toHaveAttribute("data-dashboard-mode", "executive");
    await expect(playsLikePanel).toHaveCount(0);

    await controls.getByRole("button", { name: /Standard/i }).click();
    await expect(grid).toHaveAttribute("data-dashboard-mode", "standard");
    await expect(playsLikePanel).toBeVisible();

    await playsLikeControls.getByRole("button", { name: /Hide/i }).click();
    await expect(playsLikePanel).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => window.localStorage.getItem("fkh:dashboard-workspace-layout:v1")),
      )
      .toContain("plays-like");

    await page.reload({ waitUntil: "commit" });
    await expectAppText(page, /Dashboard layout/i, 45_000);
    await expect(page.locator('[data-dashboard-panel="plays-like"]')).toHaveCount(0);

    await page
      .locator("[data-dashboard-layout-controls]")
      .getByRole("button", { name: /Reset/i })
      .click();
    await expect(page.locator('[data-dashboard-panel="plays-like"]')).toBeVisible();
  });

  test("dashboard bento panels stay readable without a persistent AI rail", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.addInitScript(() => {
      window.localStorage.removeItem("fkh:dashboard-workspace-layout:v1");
    });

    const viewports = [
      {
        label: "1280 dashboard",
        width: 1280,
        height: 720,
        minPanelWidth: 440,
      },
      {
        label: "1440 dashboard",
        width: 1440,
        height: 900,
        minPanelWidth: 520,
      },
      {
        label: "2048 dashboard",
        width: 2048,
        height: 1100,
        minPanelWidth: 560,
      },
      {
        label: "2560 dashboard",
        width: 2560,
        height: 1440,
        minPanelWidth: 600,
      },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoAppRoute(page, "/dashboard");
      await expectAppText(page, /Quick answers/i, 45_000);
      await expect(page.locator("[data-dashboard-panel]").first()).toBeVisible();

      await expectNoAiRail(page, /AI performance rail/i);

      const minPanelWidth = await page.evaluate(() => {
        const widths = Array.from(document.querySelectorAll("[data-dashboard-panel]")).map(
          (panel) => panel.getBoundingClientRect().width,
        );

        return Math.min(...widths);
      });

      expect(
        minPanelWidth,
        `${viewport.label} should not squeeze dashboard bento cards into narrow columns`,
      ).toBeGreaterThanOrEqual(viewport.minPanelWidth);

      await expectNoHorizontalOverflow(page, viewport.label);
      await expectNoCrampedWorkbenchText(page, "dashboard", viewport.label);
    }
  });

  test("shots workbench exposes saved views, columns, density, export and assistant entry", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            window.localStorage.setItem("fkh:e2e-copied-view-link", value);
          },
        },
      });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/shots?club=driver&sort=carry&dir=desc");
    await expectPageReady(page, /Shot explorer/i);

    const shotsWorkbench = page.locator('[data-workbench-scope="shots"]').first();
    const shotsToolbar = shotsWorkbench.locator("[data-desktop-workbench-toolbar]");

    await expect(shotsToolbar).toBeVisible();
    await expectNoAiRail(page, /AI shot analyst/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Shots/i }),
    ).toBeVisible();

    await shotsToolbar.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Save current view/i })).toBeVisible();
    await expect(page.getByText(/AI suggested filters/i)).toBeVisible();
    await page.keyboard.press("Escape");

    await shotsToolbar.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Launch$/i }).click();
    await expect(page.locator('th[data-column="launch"]')).toBeHidden();
    await page.keyboard.press("Escape");

    await shotsToolbar.getByRole("button", { name: "Density", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: /Compact/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-table-density", "compact");
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      shotsToolbar.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-shots-view.csv");
    await expect(shotsToolbar.getByRole("button", { name: /Exported/i })).toBeVisible();

    const [shortcutDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.keyboard.press("E"),
    ]);
    expect(shortcutDownload.suggestedFilename()).toBe("forekinghell-shots-view.csv");

    await shotsToolbar.getByRole("button", { name: /Copy link/i }).click();
    await expect(shotsToolbar.getByRole("button", { name: /Copied/i })).toBeVisible();
    const expectedCopiedViewLink = await page.evaluate(
      () => `${window.location.origin}${window.location.pathname}${window.location.search}`,
    );
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("fkh:e2e-copied-view-link")))
      .toBe(expectedCopiedViewLink);
  });

  test("shots workbench supports selected-shot master detail", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/shots");
    await expectPageReady(page, /Shot explorer/i);

    const table = page.locator('table[data-workbench-export-table="shots"]');
    const rows = table.locator("tbody tr[tabindex]");
    const detail = page.getByRole("region", { name: /Selected shot detail/i });

    await expect(rows.nth(1)).toBeVisible();
    await expect(detail).toBeVisible();

    const selectedClub = (await rows.nth(1).locator('[data-column="club"]').innerText())
      .split("\n")[0]
      .trim();

    await rows.nth(1).click();

    await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(detail).toContainText(selectedClub);
    await expect(detail).toContainText("Club speed");
    await expect(detail).toContainText("Smash");
    await expect(detail.getByRole("link", { name: /Filter this club/i })).toHaveAttribute(
      "href",
      /\/shots\?club=/,
    );
  });

  test("saved view manager saves and removes current filters", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/shots?sort=carry");
    await expectPageReady(page, /Shot explorer/i);
    await page.evaluate(() => window.localStorage.removeItem("fkh:saved-views:shots"));
    await page.evaluate(() => window.localStorage.removeItem("fkh:visible-columns:shots"));
    await page.evaluate(() => window.localStorage.removeItem("fkh:desktop-workbench-density"));
    await page.reload();
    await expectPageReady(page, /Shot explorer/i);

    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Launch$/i }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Density", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: /Compact/i }).click();
    await page.keyboard.press("Escape");

    await expect(page.locator('th[data-column="launch"]')).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-table-density", "compact");

    await page.getByRole("button", { name: /Saved views/i }).click();
    await page.getByRole("menuitem", { name: /Save current view/i }).click();
    const saveDialog = page.getByRole("dialog", { name: /Save table view/i });
    await expect(saveDialog).toBeVisible();
    await saveDialog.getByLabel(/View name/i).fill("Driver carry audit");
    await saveDialog.getByRole("button", { name: /^Save view$/i }).click();
    await expect(saveDialog).toHaveCount(0);

    await page.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /^Driver carry audit/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Remove Driver carry audit/i })).toBeVisible();

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitem", { name: /Show all columns/i }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Density", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: /Comfortable/i }).click();
    await page.keyboard.press("Escape");

    await expect(page.locator('th[data-column="launch"]')).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-table-density", "comfortable");

    await page.getByRole("button", { name: /Saved views/i }).click();
    await page.getByRole("menuitem", { name: /^Driver carry audit/i }).click();
    await expect(page.locator('th[data-column="launch"]')).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-table-density", "compact");

    await page.getByRole("button", { name: /Saved views/i }).click();
    await page.getByRole("menuitem", { name: /Remove Driver carry audit/i }).click();
    await expect(page.getByRole("menuitem", { name: /^Driver carry audit/i })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("fkh:saved-views:shots") ?? ""))
      .not.toContain("Driver carry audit");
  });

  test("table column and density preferences persist after reload", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/shots");
    await expectPageReady(page, /Shot explorer/i);
    await page.evaluate(() => {
      window.localStorage.removeItem("fkh:visible-columns:shots");
      window.localStorage.removeItem("fkh:desktop-workbench-density");
    });
    await page.reload();
    await expectPageReady(page, /Shot explorer/i);

    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Launch$/i }).click();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Density", exact: true }).click();
    await page.getByRole("menuitemcheckbox", { name: /Compact/i }).click();
    await page.keyboard.press("Escape");

    await expect(page.locator('th[data-column="launch"]')).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-table-density", "compact");

    await page.reload();
    await expectPageReady(page, /Shot explorer/i);
    await expect(page.locator('th[data-column="launch"]')).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-table-density", "compact");
  });

  test("rounds workbench supports saved filters, columns, export and assistant entry", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/rounds?filter=scorecard-only");
    await expectPageReady(page, /AI round rail/i);

    await expectNoAiRail(page, /AI round rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Rounds/i }),
    ).toBeVisible();
    await expect(page.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(page.getByRole("button", { name: /Scorecard only/i }).first()).toHaveAttribute(
      "data-variant",
      "default",
    );

    const roundTable = page.locator('table[data-workbench-export-table="rounds"]');
    const dateHead = roundTable.locator('th[data-column="date"]');
    const scoreHead = roundTable.locator('th[data-column="score"]');

    await expect(dateHead).toHaveAttribute("aria-sort", "descending");
    await scoreHead.getByRole("button", { name: /Sort rounds by Score/i }).click();
    await expect(scoreHead).toHaveAttribute("aria-sort", "ascending");
    await expect(dateHead).toHaveAttribute("aria-sort", "none");
    const visibleScores = await roundTable
      .locator('tbody tr td[data-column="score"]')
      .evaluateAll((cells) =>
        cells
          .map((cell) => Number(cell.textContent?.trim()))
          .filter((value) => Number.isFinite(value)),
      );
    expect(visibleScores).toEqual([...visibleScores].sort((left, right) => left - right));

    await page.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByText(/Scorecard-only cleanup/i)).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Putts$/i }).click();
    await expect(page.locator('th[data-column="putts"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-rounds-view.csv");
    await expect(page.getByRole("button", { name: /Exported/i })).toBeVisible();
  });

  test("courses workbench supports saved views, columns, export and table focus", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/courses?tab=patterns");
    await expectPageReady(page, /AI course rail/i);

    await expectNoAiRail(page, /AI course rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Courses/i }),
    ).toBeVisible();
    await expect(page.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Course library table",
    );

    const courseTable = page.locator('table[data-workbench-export-table="courses"]');
    const courseHead = courseTable.locator('th[data-column="course"]');
    const holesHead = courseTable.locator('th[data-column="holes"]');

    await expect(courseHead).toHaveAttribute("aria-sort", "ascending");
    await holesHead.getByRole("link", { name: /Sort courses by Mapped holes/i }).click();
    await expect(page).toHaveURL(/\/courses\?tab=patterns&sort=holes&dir=desc/);
    await expect(holesHead).toHaveAttribute("aria-sort", "descending");
    await expect(courseHead).toHaveAttribute("aria-sort", "none");
    const visibleMappedHoles = await courseTable
      .locator('tbody tr td[data-column="holes"]')
      .evaluateAll((cells) =>
        cells
          .map((cell) => Number(cell.textContent?.trim()))
          .filter((value) => Number.isFinite(value)),
      );
    expect(visibleMappedHoles).toEqual([...visibleMappedHoles].sort((left, right) => right - left));

    await page.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Mapped courses/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Course data cleanup/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /Mapped holes/i }).click();
    await expect(page.locator('th[data-column="holes"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const mappedCourseHref = await courseTable.locator("tbody tr").evaluateAll((rows) => {
      for (const row of rows) {
        const mappedHoles = Number(
          row.querySelector('[data-column="holes"]')?.textContent?.trim() ?? "",
        );
        const href = (
          row.querySelector('a[href$="/holes"]') as HTMLAnchorElement | null
        )?.getAttribute("href");

        if (Number.isFinite(mappedHoles) && mappedHoles > 0 && href) {
          return href;
        }
      }

      return "";
    });
    expect(mappedCourseHref).toBeTruthy();

    await gotoAppRoute(page, mappedCourseHref as string);
    await expectPageReady(page, /Geometry preview/i);
    await expectNoAiRail(page, /AI course rail/i);
    await expect(page.locator('[data-workbench-scope="course-holes"]')).toBeVisible();
    await expect(page.locator('[data-workbench-scope="courses"]')).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']").first()).toHaveAttribute(
      "aria-label",
      "Course hole geometry table",
    );
    const holeBreadcrumb = page.getByRole("navigation", { name: /Breadcrumb/i });
    await expect(holeBreadcrumb.getByRole("link", { name: /Courses/i })).toHaveAttribute(
      "href",
      "/courses",
    );
    await expect(holeBreadcrumb.locator('[aria-current="page"]')).toHaveText(/Hole management/i);
    const geometryRegion = page.getByRole("region", {
      name: /Course geometry preview chart accessibility/i,
    });
    await expect(geometryRegion).toBeVisible();
    await expect(
      geometryRegion.getByRole("link", { name: /Explain Course geometry preview chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await geometryRegion
      .locator("summary", { hasText: /View Course geometry preview chart data table/i })
      .click();
    await expect(
      geometryRegion.getByRole("table", { name: /Course geometry preview chart data table/i }),
    ).toBeVisible();

    const patternHref = (mappedCourseHref as string).replace(/\/holes$/, "/shot-pattern");
    await gotoAppRoute(page, patternHref);
    await expectPageReady(page, /shot pattern/i);
    await expect(page.locator('[data-workbench-scope="course-shot-pattern"]')).toBeVisible();
    await expect(page.locator('[data-workbench-scope="shot-pattern-setup"]')).toBeVisible();
    await expectNoAiRail(page, /AI course rail/i);
    await expect(
      page.getByRole("table", { name: /Shot pattern mapped holes table/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("table", { name: /Shot pattern club evidence table/i }),
    ).toBeVisible();
    const coursePatternRegion = page.getByRole("region", {
      name: /Course shot pattern chart accessibility/i,
    });
    await expect(coursePatternRegion).toBeVisible();
    await expect(
      coursePatternRegion.getByRole("link", { name: /Explain Course shot pattern chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await coursePatternRegion
      .locator("summary", { hasText: /View Course shot pattern chart data table/i })
      .click();
    await expect(
      coursePatternRegion.getByRole("table", { name: /Course shot pattern chart data table/i }),
    ).toBeVisible();

    await gotoAppRoute(page, "/courses?tab=patterns&sort=holes&dir=desc");
    await expectPageReady(page, /AI course rail/i);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-courses-view.csv");
    await expect(page.getByRole("button", { name: /Exported/i })).toBeVisible();
  });

  test("course record course and detail pages use desktop command workbench scopes", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAppRoute(page, "/course-records");
    await expectPageReady(page, /AI course records rail/i);
    const courseRecordsHref = await page
      .locator('a[href^="/courses/"][href$="/records"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href") ?? "")
          .find((href) => /^\/courses\/[^/?#]+\/records$/.test(href)),
      );
    expect(courseRecordsHref).toBeTruthy();

    await gotoAppRoute(page, courseRecordsHref as string);
    await expectAppText(page, /Course champion|Course record table/i, 45_000);
    await expect(page.locator('[data-workbench-scope="course-records-course"]')).toBeVisible();
    await expectNoAiRail(page, /AI course rail/i);
    await expect(
      page.getByRole("table", { name: /Course-specific record board table/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "course record course board");
    await expectNoCrampedWorkbenchText(page, "course-records-course", "course record course board");

    const recordDetailHref = await page
      .locator('a[href^="/course-records/"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href") ?? "")
          .find((href) => /^\/course-records\/[^/?#]+/.test(href)),
      );
    expect(recordDetailHref).toBeTruthy();

    await gotoAppRoute(page, recordDetailHref as string);
    await expectAppText(page, /Honours board|Verified board/i, 45_000);
    await expect(page.locator('[data-workbench-scope="course-record-detail"]')).toBeVisible();
    await expectNoAiRail(page, /AI course records rail/i);
    await expect(
      page.getByRole("table", { name: /Course record leaderboard table/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "course record detail board");
    await expectNoCrampedWorkbenchText(page, "course-record-detail", "course record detail board");
  });

  test("bag gapping table supports saved views, columns and export", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/bag");
    await expectPageReady(page, /Bag|Gapping/i);
    await expect(page.getByRole("table", { name: /Full bag gapping table/i })).toBeVisible({
      timeout: 45_000,
    });
    await expectNoAiRail(page, /AI bag rail/i);
    const bagPatternRegion = page
      .getByRole("region", { name: /shot pattern chart accessibility/i })
      .filter({ visible: true })
      .first();
    await expect(bagPatternRegion).toBeVisible();
    await expect(
      bagPatternRegion.getByRole("link", { name: /Explain .* shot pattern chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await bagPatternRegion
      .locator("summary", { hasText: /View .* shot pattern chart data table/i })
      .click();
    await expect(
      bagPatternRegion.getByRole("table", { name: /shot pattern chart data table/i }),
    ).toBeVisible();

    const facePathRegion = page
      .getByRole("region", { name: /face\/path delivery chart accessibility/i })
      .filter({ visible: true })
      .first();
    await expect(facePathRegion).toBeVisible();
    await expect(
      facePathRegion.getByRole("link", { name: /Explain .* face\/path delivery chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await facePathRegion
      .locator("summary", { hasText: /View .* face\/path delivery chart data table/i })
      .click();
    await expect(
      facePathRegion.getByRole("table", { name: /face\/path delivery chart data table/i }),
    ).toBeVisible();

    const clubDispersionRegion = page
      .getByRole("region", { name: /dispersion chart accessibility/i })
      .filter({ visible: true })
      .first();
    await expect(clubDispersionRegion).toBeVisible();
    await expect(
      clubDispersionRegion.getByRole("link", { name: /Explain .* dispersion chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await clubDispersionRegion
      .locator("summary", { hasText: /View .* dispersion chart data table/i })
      .click();
    await expect(
      clubDispersionRegion.getByRole("table", { name: /dispersion chart data table/i }),
    ).toBeVisible();

    const gappingTable = page.locator("[data-bag-gapping-table]");
    await expect(gappingTable.getByText("Full gapping table")).toBeVisible();

    await expect(
      gappingTable.getByRole("region", { name: "Full bag gapping table" }),
    ).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Full bag gapping table",
    );
    await expect(gappingTable.locator("[data-desktop-workbench-toolbar]")).toBeVisible();

    await gappingTable.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Low confidence clubs/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await gappingTable.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Target$/i }).click();
    await expect(gappingTable.locator('th[data-column="target"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      gappingTable.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-bag-gapping-view.csv");
    await expect(gappingTable.getByRole("button", { name: /Exported/i })).toBeVisible();
  });

  test("progress bag movement table supports saved views, columns and export", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/progress");
    await expectPageReady(page, /Bag progress|Progress/i);
    await expectNoAiRail(page, /AI progress rail/i);

    const progressTable = page.locator('[data-workbench-scope="progress-bag-movement"]');
    await expect(progressTable.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(
      progressTable.getByRole("region", { name: "Progress bag movement table" }),
    ).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Progress bag movement table",
    );

    await progressTable.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Clubs needing work/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await progressTable.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Clean shots$/i }).click();
    await expect(progressTable.locator('th[data-column="clean-shots"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      progressTable.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-progress-bag-movement.csv");
    await expect(progressTable.getByRole("button", { name: /Exported/i })).toBeVisible();
    await expectNoHorizontalOverflow(page, "progress bag movement table");
  });

  test("club analytics charts expose local explain and data fallbacks", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/bag");
    await expectPageReady(page, /Bag|Gapping/i);
    await expectNoAiRail(page, /AI bag rail/i);

    const analyticsHref = await page
      .locator('a[href^="/bag/"][href$="/analytics"]')
      .first()
      .getAttribute("href");
    expect(analyticsHref).toBeTruthy();

    await gotoAppRoute(page, analyticsHref as string);
    await expectPageReady(page, /AI club rail/i);

    const clubBreadcrumb = page.getByRole("navigation", { name: /Breadcrumb/i });
    await expect(clubBreadcrumb.getByRole("link", { name: /Bag/i })).toHaveAttribute(
      "href",
      "/bag",
    );
    await expect(clubBreadcrumb.locator('[aria-current="page"]')).toHaveText(/Club analytics/i);
    await expectNoAiRail(page, /AI club rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Club analytics/i }),
    ).toBeVisible();
    await expect(page.locator("main").getByText(/AI .* workbench/i)).toHaveCount(0);

    const shotCloudRegion = page.getByRole("region", {
      name: /Shot cloud chart accessibility/i,
    });
    await expect(shotCloudRegion).toBeVisible();
    await expect(
      shotCloudRegion.getByRole("link", { name: /Explain Shot cloud chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await shotCloudRegion
      .locator("summary", { hasText: /View Shot cloud chart data table/i })
      .click();
    await expect(
      shotCloudRegion.getByRole("table", { name: /Shot cloud chart data table/i }),
    ).toBeVisible();

    const distanceRegion = page.getByRole("region", {
      name: /Distance profile chart accessibility/i,
    });
    await expect(distanceRegion).toBeVisible();
    await expect(
      distanceRegion.getByRole("link", { name: /Explain Distance profile chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await distanceRegion
      .locator("summary", { hasText: /View Distance profile chart data table/i })
      .click();
    await expect(
      distanceRegion.getByRole("table", { name: /Distance profile chart data table/i }),
    ).toBeVisible();

    const launchRegion = page.getByRole("region", {
      name: /Launch window chart accessibility/i,
    });
    await expect(launchRegion).toBeVisible();
    await expect(
      launchRegion.getByRole("link", { name: /Explain Launch window chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await launchRegion
      .locator("summary", { hasText: /View Launch window chart data table/i })
      .click();
    await expect(
      launchRegion.getByRole("table", { name: /Launch window chart data table/i }),
    ).toBeVisible();
  });

  test("club profile charts expose local explain and data fallbacks", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/bag");
    await expectPageReady(page, /Bag|Gapping/i);
    await expectNoAiRail(page, /AI bag rail/i);

    const profileHref = await waitForHref(page, 'a[href^="/bag/"]', "^/bag/[^/?#]+$", [
      "/bag/longest",
    ]);
    expect(profileHref).toBeTruthy();

    await gotoAppRoute(page, profileHref as string);
    await expectPageReady(page, /Dispersion Map/i);
    await expect(page.locator('[data-workbench-scope="club-profile"]')).toBeVisible();
    const clubBreadcrumb = page.getByRole("navigation", { name: /Breadcrumb/i });
    await expect(clubBreadcrumb.getByRole("link", { name: /Bag/i })).toHaveAttribute(
      "href",
      "/bag",
    );
    await expect(clubBreadcrumb.locator('[aria-current="page"]')).toHaveText(/Club profile/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Club profile/i }),
    ).toBeVisible();
    await expectNoAiRail(page, /AI club rail/i);

    const dispersionRegion = page.getByRole("region", {
      name: /dispersion map chart accessibility/i,
    });
    await expect(dispersionRegion).toBeVisible();
    await expect(
      dispersionRegion.getByRole("link", { name: /Explain .* dispersion map chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await dispersionRegion
      .locator("summary", { hasText: /View .* dispersion map chart data table/i })
      .click();
    await expect(
      dispersionRegion.getByRole("table", { name: /dispersion map chart data table/i }),
    ).toBeVisible();

    const trajectoryRegion = page.getByRole("region", {
      name: /Club trajectory chart accessibility/i,
    });
    await expect(trajectoryRegion).toBeVisible();
    await expect(
      trajectoryRegion.getByRole("link", { name: /Explain Club trajectory chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await trajectoryRegion
      .locator("summary", { hasText: /View Club trajectory chart data table/i })
      .click();
    await expect(
      trajectoryRegion.getByRole("table", { name: /Club trajectory chart data table/i }),
    ).toBeVisible();
  });

  test("longest shots simulator exposes local explain and data fallback", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/bag/longest");
    await expectPageReady(page, /Longest shot simulator/i);
    await expect(page.locator('[data-workbench-scope="longest-shots-route"]')).toBeVisible();
    await expectNoAiRail(page, /AI bag rail/i);

    const longestRegion = page.getByRole("region", {
      name: /Longest shots chart accessibility/i,
    });
    await expect(longestRegion).toBeVisible();
    await expect(
      longestRegion.getByRole("link", { name: /Explain Longest shots chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await longestRegion
      .locator("summary", { hasText: /View Longest shots chart data table/i })
      .click();
    await expect(
      longestRegion.getByRole("table", { name: /Longest shots chart data table/i }),
    ).toBeVisible();

    const flightRegion = page.getByRole("region", {
      name: /Flight profile chart accessibility/i,
    });
    await expect(flightRegion).toBeVisible();
    await expect(
      flightRegion.getByRole("link", { name: /Explain Flight profile chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await flightRegion
      .locator("summary", { hasText: /View Flight profile chart data table/i })
      .click();
    await expect(
      flightRegion.getByRole("table", { name: /Flight profile chart data table/i }),
    ).toBeVisible();

    await expect(page.locator('[data-workbench-scope="longest-shots"]')).toBeVisible();
    await expect(
      page.getByRole("table", { name: /Longest shot PB evidence table/i }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "longest shots simulator");
    await expectNoCrampedWorkbenchText(page, "longest-shots-route", "longest shots simulator");
  });

  test("compare charts expose local explain and data fallbacks", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/compare");
    await expectPageReady(page, /Compare/i);

    await expectNoAiRail(page, /AI compare rail/i);
    await expect(page.locator("main").getByText(/AI .* workbench/i)).toHaveCount(0);

    const periodRegion = page.getByRole("region", {
      name: /Compare period trend chart accessibility/i,
    });
    await expect(periodRegion).toBeVisible();
    await expect(
      periodRegion.getByRole("link", { name: /Explain Compare period trend chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await periodRegion
      .locator("summary", { hasText: /View Compare period trend chart data table/i })
      .click();
    await expect(
      periodRegion.getByRole("table", { name: /Compare period trend chart data table/i }),
    ).toBeVisible();

    const radarRegion = page.getByRole("region", {
      name: /Compare radar chart accessibility/i,
    });
    await expect(radarRegion).toBeVisible();
    await expect(
      radarRegion.getByRole("link", { name: /Explain Compare radar chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await radarRegion
      .locator("summary", { hasText: /View Compare radar chart data table/i })
      .click();
    await expect(
      radarRegion.getByRole("table", { name: /Compare radar chart data table/i }),
    ).toBeVisible();

    const dispersionRegion = page.getByRole("region", {
      name: /Club dispersion chart accessibility/i,
    });
    await expect(dispersionRegion).toBeVisible();
    await expect(
      dispersionRegion.getByRole("link", { name: /Explain Club dispersion chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await dispersionRegion
      .locator("summary", { hasText: /View Club dispersion chart data table/i })
      .click();
    await expect(
      dispersionRegion.getByRole("table", { name: /Club dispersion chart data table/i }),
    ).toBeVisible();
  });

  test("leaderboard tables support saved views, columns, export and table focus", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/leaderboard?tab=monthly");
    await expectPageReady(page, /Leaderboard/i);

    await expectNoAiRail(page, /AI leaderboard rail/i);
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Leaderboard player table",
    );

    await page.getByRole("link", { name: /Sort leaderboard players by Monthly shots/i }).click();
    await expect(page.locator('th[data-column="monthly-shots"]')).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    const monthlyShotValues = await page
      .locator('tbody tr td[data-column="monthly-shots"]')
      .evaluateAll((cells) =>
        cells
          .map((cell) => Number(cell.textContent?.trim()))
          .filter((value) => Number.isFinite(value)),
      );
    expect(monthlyShotValues).toEqual([...monthlyShotValues].sort((left, right) => right - left));

    await page.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Monthly XP race/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Verified leaderboard rows/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /Monthly shots/i }).click();
    await expect(page.locator('th[data-column="monthly-shots"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [playerDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(playerDownload.suggestedFilename()).toBe("forekinghell-leaderboard-players-view.csv");
    await expect(page.getByRole("button", { name: /Exported/i })).toBeVisible();

    await gotoAppRoute(page, "/leaderboard?tab=challenges");
    await expectPageReady(page, /Challenge leaderboards/i);
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Challenge leaderboard table",
    );

    await page.getByRole("link", { name: /Sort challenge leaderboards by Participants/i }).click();
    await expect(page.locator('th[data-column="participants"]')).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    const participantValues = await page
      .locator('tbody tr td[data-column="participants"]')
      .evaluateAll((cells) =>
        cells
          .map((cell) => Number(cell.textContent?.trim()))
          .filter((value) => Number.isFinite(value)),
      );
    expect(participantValues).toEqual([...participantValues].sort((left, right) => right - left));

    await page.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Active challenge boards/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /Participants/i }).click();
    await expect(page.locator('th[data-column="participants"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [challengeDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(challengeDownload.suggestedFilename()).toBe(
      "forekinghell-challenge-leaderboards-view.csv",
    );
  });

  test("challenge and tournament detail pages use desktop command workbench scopes", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAppRoute(page, "/challenges");
    await expectPageReady(page, /Challenges/i);
    await expect(page.getByRole("table", { name: /Challenge board table/i })).toBeVisible({
      timeout: 45_000,
    });
    const challengeHref = await page
      .locator('a[href^="/challenges/"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href") ?? "")
          .find((href) => /^\/challenges\/[^/?#]+$/.test(href) && href !== "/challenges/new"),
      );
    expect(challengeHref).toBeTruthy();

    await gotoAppRoute(page, challengeHref as string);
    await expectAppText(page, /Challenge command board/i, 45_000);
    await expect(page.locator('[data-workbench-scope="challenge-detail"]')).toBeVisible();
    await expect(page.locator('[data-workbench-scope="challenge-leaderboard"]')).toBeVisible();
    await expect(page.locator('[data-workbench-scope="challenge-attempts"]')).toBeVisible();
    await expectNoAiRail(page, /AI challenge rail/i);
    await expect(page.getByRole("table", { name: /Challenge leaderboard table/i })).toBeVisible();

    await gotoAppRoute(page, "/tournaments");
    await expectPageReady(page, /Tournaments/i);
    const tournamentHref = await page
      .locator('a[href^="/tournaments/"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href") ?? "")
          .find(
            (href) =>
              /^\/tournaments\/[^/?#]+$/.test(href) &&
              href !== "/tournaments/new" &&
              !href.includes("/leaderboard") &&
              !href.includes("/rounds") &&
              !href.includes("/rules") &&
              !href.includes("/submit"),
          ),
      );
    expect(tournamentHref).toBeTruthy();

    await gotoAppRoute(page, tournamentHref as string);
    await expectAppText(page, /Submit round|Tournament standings|Podium/i, 45_000);
    await expect(page.locator('[data-workbench-scope="tournament-detail"]')).toBeVisible();
    await expect(page.locator('[data-workbench-scope="tournament-standings"]')).toBeVisible();
    await expectNoAiRail(page, /AI tournament rail/i);
    await expect(page.getByRole("table", { name: /Tournament standings table/i })).toBeVisible();
  });

  test("feed activity ledger supports saved views, columns, export and semantic rails", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/feed");
    await expectPageReady(page, /Feed/i);
    await expect(page.locator('[data-workbench-scope="feed"]')).toBeVisible();
    await expectNoAiRail(page, /AI feed rail/i);

    await expect(
      page.getByRole("complementary", { name: /Feed profile shortcuts/i }),
    ).toBeVisible();
    const insightRail = page.getByRole("complementary", { name: /Feed social insight rail/i });
    await expect(insightRail).toBeVisible();
    await expect(insightRail.getByText(/Network pulse/i)).toBeVisible();
    await expect(insightRail.getByText(/Privacy state/i)).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Feed activity ledger table",
    );

    const ledger = page.locator('[data-workbench-scope="feed-activity"]');
    await expect(ledger.locator("[data-desktop-workbench-toolbar]")).toBeVisible();

    await ledger.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Friends Friend activity/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /PBs Personal-best/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await ledger.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Privacy$/i }).click();
    await expect(ledger.locator('th[data-column="privacy"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      ledger.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-feed-activity-all.csv");
    await expect(ledger.getByRole("button", { name: /Exported/i })).toBeVisible();
    await expectNoHorizontalOverflow(page, "feed activity ledger");
    await expectNoCrampedWorkbenchText(page, "feed", "feed activity ledger");
  });

  test("friends manager supports saved views, columns, export and semantic rails", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/friends");
    await expectPageReady(page, /Friend manager/i);
    await expectNoAiRail(page, /AI friend rail/i);

    await expect(page.getByRole("complementary", { name: /Friend invite rail/i })).toBeVisible();
    await expect(page.getByRole("complementary", { name: /Friend discovery rail/i })).toBeVisible();
    await expect(page.getByRole("complementary", { name: /Friend safety rail/i })).toBeVisible();
    await expect(page.getByLabel(/Search public profiles by username/i)).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Friend graph table",
    );

    const manager = page.locator('[data-workbench-scope="friend-graph"]');
    await expect(manager.locator("[data-desktop-workbench-toolbar]")).toBeVisible();

    await manager.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Incoming requests/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Blocked users/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await manager.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /Home course/i }).click();
    await expect(manager.locator('th[data-column="home-course"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      manager.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-friend-graph.csv");
    await expect(manager.getByRole("button", { name: /Exported/i })).toBeVisible();
  });

  test("groups board supports saved views, columns, export and semantic rails", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/groups");
    await expectPageReady(page, /Group board/i);
    await expectNoAiRail(page, /AI group rail/i);

    await expect(page.locator('[data-workbench-scope="groups"]')).toBeVisible();
    await expect(page.getByRole("complementary", { name: /Group operations rail/i })).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: /Group activity digest rail/i }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: /Group board views/i })).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Group board table",
    );

    const board = page.locator('[data-workbench-scope="group-board"]');
    await expect(board.locator("[data-desktop-workbench-toolbar]")).toBeVisible();

    await board.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Challenge groups/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Create group/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await board.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Posts$/i }).click();
    await expect(board.locator('th[data-column="posts"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      board.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-groups-active.csv");
    await expect(board.getByRole("button", { name: /Exported/i })).toBeVisible();

    const groupDetailHref = await board.locator('a[href^="/groups/"]').first().getAttribute("href");
    expect(groupDetailHref).toBeTruthy();

    await gotoAppRoute(page, groupDetailHref as string);
    await expectPageReady(page, /Group operations board/i);
    await expectNoAiRail(page, /AI group rail/i);
    await expect(page.locator('[data-workbench-scope="group-detail"]')).toBeVisible();
    await expect(page.locator('[data-workbench-scope="group-members"]')).toBeVisible();
    await expect(page.locator('[data-workbench-scope="group-challenges"]')).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']").first()).toHaveAttribute(
      "aria-label",
      "Group member roster table",
    );
    const groupBreadcrumb = page.getByRole("navigation", { name: /Breadcrumb/i });
    await expect(groupBreadcrumb.getByRole("link", { name: /Groups/i })).toHaveAttribute(
      "href",
      "/groups",
    );
    await expect(groupBreadcrumb.locator('[aria-current="page"]')).toHaveText(/Group detail/i);
  });

  test("profile editor exposes desktop preview rails and privacy form", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/profile");
    await expectPageReady(page, /Profile/i);
    await expectNoAiRail(page, /AI profile rail/i);

    const profileWorkbench = page.locator('[data-workbench-scope="profile"]');
    await expect(profileWorkbench).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: /Profile completion rail/i }),
    ).toBeVisible();
    await expect(page.getByRole("complementary", { name: /Profile invite rail/i })).toBeVisible();
    await expect(page.getByRole("form", { name: /Identity and privacy settings/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Public view/i })).toBeVisible();
    await expect(profileWorkbench.getByText(/Public sees/i)).toBeVisible();
    const profileEvidence = profileWorkbench.locator(
      '[data-workbench-scope="profile-evidence"]',
    );
    await expect(profileEvidence).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Profile evidence ledger table",
    );
    await expect(
      profileEvidence.locator('table[data-workbench-export-table="profile-evidence-ledger"]'),
    ).toBeVisible();

    await profileEvidence.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Course records/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Privacy settings/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await profileEvidence.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Proof$/i }).click();
    await expect(profileEvidence.locator('th[data-column="proof"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      profileEvidence.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^forekinghell-profile-[a-z0-9-]+-evidence\.csv$/,
    );
    await expect(page.getByRole("button", { name: /Save profile/i })).toBeVisible();
  });

  test("public profile exposes privacy-aware activity and bag workbenches", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/profile");
    await expectPageReady(page, /Profile/i);

    const publicProfileHref = await page
      .getByRole("link", { name: /Public view/i })
      .getAttribute("href");
    expect(publicProfileHref).toBeTruthy();

    await gotoAppRoute(page, publicProfileHref as string);
    await expectPageReady(page, /Visible activity ledger/i);
    await expectNoAiRail(page, /AI profile rail/i);

    await expect(page.locator('[data-workbench-scope="public-profile"]')).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: /Public profile stats rail/i }),
    ).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Profile activity ledger table",
    );

    const activity = page.locator('[data-workbench-scope="profile-activity"]');
    await expect(activity.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await activity.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Visible activity/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Friend manager/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await activity.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Privacy$/i }).click();
    await expect(activity.locator('th[data-column="privacy"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      activity.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^forekinghell-profile-[a-z0-9-]+-activity\.csv$/);
    await expect(activity.getByRole("button", { name: /Exported/i })).toBeVisible();

    const bagComparison = page.locator('[data-workbench-scope="profile-bag-comparison"]');
    await expect(bagComparison.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(
      page.getByRole("table", { name: /Profile visible bag comparison table/i }),
    ).toBeVisible();
  });

  test("round detail exposes a desktop review rail and scorecard anchors", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/rounds");
    await expectAppText(page, /AI round rail/i, 45_000);

    const roundHref = await page
      .locator('a[href^="/rounds/"]')
      .evaluateAll((anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute("href"))
          .find((href) =>
            Boolean(href && href !== "/rounds/new" && /^\/rounds\/[^/?#]+$/.test(href)),
          ),
      );

    expect(roundHref).toBeTruthy();
    await gotoAppRoute(page, roundHref as string);
    await expectAppText(page, /AI round rail/i, 45_000);

    const roundBreadcrumb = page.getByRole("navigation", { name: /Breadcrumb/i });
    await expect(roundBreadcrumb.getByRole("link", { name: /Rounds/i })).toHaveAttribute(
      "href",
      "/rounds",
    );
    await expect(roundBreadcrumb.locator('[aria-current="page"]')).toHaveText(/Round review/i);
    await expectNoAiRail(page, /AI round rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Rounds/i }),
    ).toBeVisible();
    await expect(page.locator("#scorecard")).toBeVisible();
    await expect(page.locator("#course-link")).toBeVisible();
    await expect(page.getByRole("link", { name: /Scorecard/i }).first()).toBeVisible();
    const scorecardRegion = page
      .getByRole("region", {
        name: /Course scorecard chart accessibility/i,
      })
      .first();
    await expect(scorecardRegion).toBeVisible();
    await expect(
      scorecardRegion.getByRole("link", { name: /Explain Course scorecard chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await scorecardRegion
      .locator("summary", { hasText: /View Course scorecard chart data table/i })
      .click();
    await expect(
      scorecardRegion.getByRole("table", { name: /Course scorecard chart data table/i }),
    ).toBeVisible();
    const roundMapRegion = page.getByRole("region", {
      name: /Round shot map chart accessibility/i,
    });
    await expect(roundMapRegion).toBeVisible();
    await expect(
      roundMapRegion.getByRole("link", { name: /Explain Round shot map chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await roundMapRegion
      .locator("summary", { hasText: /View Round shot map chart data table/i })
      .click();
    await expect(
      roundMapRegion.getByRole("table", { name: /Round shot map chart data table/i }),
    ).toBeVisible();

    const shotCorrections = page.locator("#shots");
    await expect(shotCorrections).toBeVisible();
    await shotCorrections.locator("summary").click();
    const roundShots = page.locator('[data-workbench-scope="round-shots"]');
    await expect(roundShots.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(
      roundShots.getByRole("region", { name: /Round shot club corrections table/i }),
    ).toBeVisible();
    await expect(
      roundShots.locator('table[data-workbench-export-table="round-shots"]'),
    ).toBeVisible();
    await roundShots.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Side$/i }).click();
    await expect(roundShots.locator('th[data-column="side"]')).toBeHidden();
    await page.keyboard.press("Escape");
  });

  test("shared account route exposes read-only desktop table controls", async ({ page }) => {
    skipWhenNoDesktopAuth();
    test.skip(!authUserId, "Set PLAYWRIGHT_AUTH_STATE to derive the shared account route.");

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, `/shared/${authUserId}`);
    await expectPageReady(page, /Shared account/i);
    await expectNoAiRail(page, /AI shared rail/i);
    await expect(page.locator('[data-workbench-scope="shared-account"]')).toBeVisible();

    const sharedSessions = page.locator('[data-workbench-scope="shared-sessions"]');
    await expect(sharedSessions.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(
      sharedSessions.getByRole("region", { name: /Shared account recent sessions table/i }),
    ).toBeVisible();
    await expect(
      sharedSessions.locator('table[data-workbench-export-table="shared-sessions"]'),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Social feed/i })).toHaveCount(0);

    await sharedSessions.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Score$/i }).click();
    await expect(sharedSessions.locator('th[data-column="score"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      sharedSessions.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-shared-sessions.csv");
    await expect(sharedSessions.getByRole("button", { name: /Exported/i })).toBeVisible();
  });

  test("admin users console table supports saved views, columns and export", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/admin/users");
    await expectAppText(page, /Users and access/i, 45_000);

    await expect(page.locator('[data-workbench-scope="admin-users"]')).toBeVisible();
    await expectNoAiRail(page, /AI admin rail/i);
    await expect(page.getByRole("table", { name: /Admin user accounts/i })).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Admin user accounts table",
    );
    await expect(page.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    const deactivateButtons = page.getByRole("button", { name: /^Deactivate$/i });
    if ((await deactivateButtons.count()) > 0) {
      await expect(deactivateButtons.first()).toHaveAttribute("data-confirm-submit", "true");
      await expect(deactivateButtons.first()).toHaveAttribute(
        "data-confirm-message",
        /Deactivate admin access/i,
      );
      await deactivateButtons.first().click();
      const confirmDialog = page.getByRole("dialog", { name: /Confirm action/i });
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog).toContainText(/Deactivate admin access/i);
      await expect(confirmDialog).toContainText(/writes an audit entry/i);
      await confirmDialog.getByRole("button", { name: /^Cancel$/i }).click();
      await expect(confirmDialog).toBeHidden();
    }

    await page.getByRole("link", { name: /Sort admin users by Activity/i }).click();
    await expect(page.locator('th[data-column="activity"]')).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    const activityValues = await page
      .locator('tbody tr td[data-column="activity"]')
      .evaluateAll((cells) =>
        cells.map((cell) => {
          const values = [...(cell.textContent ?? "").matchAll(/\d+/g)].map((match) =>
            Number(match[0]),
          );
          return values.reduce((total, value) => total + value, 0);
        }),
      );
    expect(activityValues).toEqual([...activityValues].sort((left, right) => right - left));

    await page.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Owner\/operator review/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Lifetime entitlement audit/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Activity$/i }).click();
    await expect(page.locator('th[data-column="activity"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("forekinghell-admin-users-view.csv");
    await expect(page.getByRole("button", { name: /Exported/i })).toBeVisible();
  });

  test("admin billing and challenge console tables support saved views, columns and export", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAppRoute(page, "/admin/billing");
    await expectAppText(page, /Billing and entitlements/i, 45_000);
    await expectNoAiRail(page, /AI admin rail/i);
    const billingWorkbench = page.locator('[data-workbench-scope="admin-billing"]');

    await expect(billingWorkbench).toBeVisible();
    await expect(billingWorkbench.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Subscriptions table",
    );
    await expect(page.getByRole("table", { name: /Admin subscription rows/i })).toBeVisible();

    await billingWorkbench.getByRole("link", { name: /Sort admin billing by User/i }).click();
    await expect(billingWorkbench.locator('th[data-column="user"]')).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    const billingNames = await billingWorkbench
      .locator('tbody tr td[data-column="user"] p.font-medium')
      .evaluateAll((names) => names.map((name) => name.textContent?.trim() ?? ""));
    expect(billingNames).toEqual(
      [...billingNames].sort((left, right) => left.localeCompare(right)),
    );

    await billingWorkbench.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Active subscriptions/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await billingWorkbench.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Renews$/i }).click();
    await expect(billingWorkbench.locator('th[data-column="renews"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [billingDownload] = await Promise.all([
      page.waitForEvent("download"),
      billingWorkbench.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(billingDownload.suggestedFilename()).toBe("forekinghell-admin-billing-view.csv");

    await gotoAppRoute(page, "/admin/challenges");
    await expectAppText(page, /Challenges and tournaments/i, 45_000);
    await expectNoAiRail(page, /AI admin rail/i);
    const challengeWorkbench = page.locator('[data-workbench-scope="admin-challenges"]');

    await expect(challengeWorkbench).toBeVisible();
    await expect(challengeWorkbench.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Challenge boards table",
    );
    await expect(page.getByRole("table", { name: /Admin challenge boards/i })).toBeVisible();

    await challengeWorkbench
      .getByRole("link", { name: /Sort admin challenges by Participation/i })
      .click();
    await expect(challengeWorkbench.locator('th[data-column="participation"]')).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    const challengeParticipationValues = await challengeWorkbench
      .locator('tbody tr td[data-column="participation"]')
      .evaluateAll((cells) =>
        cells.map((cell) => {
          const values = [...(cell.textContent ?? "").matchAll(/\d+/g)].map((match) =>
            Number(match[0]),
          );
          return values.reduce((total, value) => total + value, 0);
        }),
      );
    expect(challengeParticipationValues).toEqual(
      [...challengeParticipationValues].sort((left, right) => right - left),
    );

    await challengeWorkbench.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Open challenge boards/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await challengeWorkbench.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Participation$/i }).click();
    await expect(challengeWorkbench.locator('th[data-column="participation"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [challengeDownload] = await Promise.all([
      page.waitForEvent("download"),
      challengeWorkbench.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(challengeDownload.suggestedFilename()).toBe("forekinghell-admin-challenges-view.csv");
  });

  test("admin moderation console queues support saved views, columns and export", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/admin/moderation");
    await expectAppText(page, /Moderation queue/i, 45_000);

    await expect(page.locator('[data-workbench-scope="admin-moderation"]')).toBeVisible();
    await expectNoAiRail(page, /AI admin rail/i);
    const reportsWorkbench = page.locator('[data-workbench-scope="admin-moderation-reports"]');
    const eventsWorkbench = page.locator('[data-workbench-scope="admin-moderation-events"]');

    await expect(reportsWorkbench.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(eventsWorkbench.locator("[data-desktop-workbench-toolbar]")).toBeVisible();
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "User reports table",
    );
    await expect(page.getByRole("table", { name: /Admin user reports/i })).toBeVisible();
    await expect(page.getByRole("table", { name: /Admin moderation events/i })).toBeVisible();
    await expect(
      reportsWorkbench.getByRole("button", { name: /Resolve selected reports/i }),
    ).toBeVisible();
    await expect(
      reportsWorkbench.getByRole("button", { name: /Resolve selected reports/i }),
    ).toHaveAttribute("data-confirm-message", /Resolve the selected open reports/i);
    await expect(
      eventsWorkbench.getByRole("button", { name: /Resolve selected events/i }),
    ).toBeVisible();
    await expect(
      eventsWorkbench.getByRole("button", { name: /Resolve selected events/i }),
    ).toHaveAttribute("data-confirm-message", /Resolve the selected open moderation events/i);

    await reportsWorkbench.getByRole("link", { name: /Sort admin reports by Reason/i }).click();
    await expect(reportsWorkbench.locator('th[data-column="reason"]')).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    const reportReasons = await reportsWorkbench
      .locator('tbody tr td[data-column="reason"]')
      .evaluateAll((cells) =>
        cells
          .map((cell) => cell.textContent?.trim() ?? "")
          .filter((value) => value && value !== "No reports yet."),
      );
    expect(reportReasons).toEqual(
      [...reportReasons].sort((left, right) => left.localeCompare(right)),
    );

    await eventsWorkbench
      .getByRole("link", { name: /Sort admin moderation events by Event/i })
      .click();
    await expect(eventsWorkbench.locator('th[data-column="event"]')).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    const eventNames = await eventsWorkbench
      .locator('tbody tr td[data-column="event"] > p:first-child')
      .evaluateAll((cells) =>
        cells
          .map((cell) => cell.textContent?.trim() ?? "")
          .filter((value) => value && value !== "No moderation events yet."),
      );
    expect(eventNames).toEqual([...eventNames].sort((left, right) => left.localeCompare(right)));

    const reportSelection = reportsWorkbench.locator(
      'input[type="checkbox"][name="reportId"]:not([disabled])',
    );
    if ((await reportSelection.count()) > 0) {
      await reportSelection.first().check();
      await expect(reportSelection.first()).toBeChecked();
    }

    const eventSelection = eventsWorkbench.locator(
      'input[type="checkbox"][name="eventId"]:not([disabled])',
    );
    if ((await eventSelection.count()) > 0) {
      await eventSelection.first().check();
      await expect(eventSelection.first()).toBeChecked();
    }

    await reportsWorkbench.getByRole("button", { name: /Saved views/i }).click();
    await expect(page.getByRole("menuitem", { name: /Open safety work/i })).toBeVisible();
    await page.keyboard.press("Escape");

    await reportsWorkbench.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Target$/i }).click();
    await expect(reportsWorkbench.locator('th[data-column="target"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [reportsDownload] = await Promise.all([
      page.waitForEvent("download"),
      reportsWorkbench.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(reportsDownload.suggestedFilename()).toBe("forekinghell-admin-reports-view.csv");

    await eventsWorkbench.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /^Reason$/i }).click();
    await expect(eventsWorkbench.locator('th[data-column="reason"]')).toBeHidden();
    await page.keyboard.press("Escape");

    const [eventsDownload] = await Promise.all([
      page.waitForEvent("download"),
      eventsWorkbench.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(eventsDownload.suggestedFilename()).toBe("forekinghell-admin-events-view.csv");
  });

  test("data chat accepts desktop prompt handoffs", async ({ page }) => {
    skipWhenNoDesktopAuth();

    const prompt = "Explain this page from visible metrics only";

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, `/data-chat?prompt=${encodeURIComponent(prompt)}`);
    await expectPageReady(page, /AI data rail/i);

    const desktopPanel = page.locator('[data-data-chat-panel="desktop"]');

    await expectNoAiRail(page, /AI data rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Data Chat/i }),
    ).toBeVisible();
    await expect(desktopPanel.locator("#desktop-data-chat-question")).toHaveValue(prompt);
    await expect(desktopPanel.locator("[data-initial-data-chat-prompt]")).toBeVisible();
    await expect(
      desktopPanel.getByRole("region", { name: "Saved Data Chat answers", exact: true }),
    ).toBeVisible();
    await expect(desktopPanel.locator("[data-performance-report-builder]")).toBeVisible();
    await expect(desktopPanel.getByLabel(/Editable performance report preview/i)).toHaveValue(
      /ForeKingHell Performance Report/,
    );

    const [reportDownload] = await Promise.all([
      page.waitForEvent("download"),
      desktopPanel.getByRole("button", { name: /Export .md/i }).click(),
    ]);
    expect(reportDownload.suggestedFilename()).toBe("forekinghell-performance-report.md");
  });

  test("priority pages expose contextual AI controls without full-width desktop prompt slabs", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();
    test.setTimeout(300_000);

    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAppRoute(page, "/dashboard");
    await expectAppText(page, /Quick answers/i, 45_000);
    await expectNoAiRail(page, /AI performance rail/i);
    await expect(page.getByText(/AI performance workbench/i)).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Dashboard/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Open AI assistant for Dashboard/i }).click();
    const dashboardAssistant = page.getByRole("dialog", { name: /Dashboard assistant/i });
    await expect(dashboardAssistant).toBeVisible();
    await expect(dashboardAssistant.getByText(/AI Caddie brief and quick answers/i)).toBeVisible();
    await page.keyboard.press("Escape");

    await gotoAppRoute(page, "/today");
    await expectPageReady(page, /Best performer|Practice score/i);
    await expectNoAiRail(page, /AI latest-practice rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Latest Practice/i }),
    ).toBeVisible();
    await expect(page.getByText(/AI latest-practice workbench/i)).toBeHidden();
    await expect(
      page.getByRole("region", { name: /Today dispersion chart accessibility/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Today trajectory chart accessibility/i }),
    ).toBeVisible();
    await page.locator("summary", { hasText: /View Today dispersion chart data table/i }).click();
    await expect(
      page.getByRole("table", { name: /Today dispersion chart data table/i }),
    ).toBeVisible();
    await page.locator("summary", { hasText: /View Today trajectory chart data table/i }).click();
    await expect(
      page.getByRole("table", { name: /Today trajectory chart data table/i }),
    ).toBeVisible();

    await gotoAppRoute(page, "/practice");
    await expectPageReady(page, /Practice Planner/i);
    await expectNoAiRail(page, /AI practice rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Practice Planner/i }),
    ).toHaveCount(0);

    await gotoAppRoute(page, "/speed");
    await expectPageReady(page, /Speed Centre|Speed/i);
    await expectNoAiRail(page, /AI speed rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Speed Centre/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: /Speed trend chart accessibility/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: /Speed trend chart accessibility/i })
        .getByRole("link", { name: /Explain Speed trend chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await page.locator("summary", { hasText: /View Speed trend chart data table/i }).click();
    await expect(page.getByRole("table", { name: /Speed trend chart data table/i })).toBeVisible();

    await gotoAppRoute(page, "/stats/training-over-time");
    await expectPageReady(page, /Training Load/i);
    await expectNoAiRail(page, /AI training-load rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Training Load/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: /Training Status chart accessibility/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: /Training Status chart accessibility/i })
        .getByRole("link", { name: /Explain Training Status chart/i }),
    ).toHaveAttribute("href", /\/data-chat\?prompt=.*Training%20Status/i);
    await expect(
      page.getByRole("region", { name: /Daily swing load chart accessibility/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: /Daily swing load chart accessibility/i })
        .getByRole("link", { name: /Explain Daily swing load chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await page.locator("summary", { hasText: /View Training Status chart data table/i }).click();
    await expect(
      page.getByRole("table", { name: /Training Status chart data table/i }),
    ).toBeVisible();
    await page.locator("summary", { hasText: /View Daily swing load chart data table/i }).click();
    await expect(
      page.getByRole("table", { name: /Daily swing load chart data table/i }),
    ).toBeVisible();

    await gotoAppRoute(page, "/equipment");
    await expectPageReady(page, /My Bag|Equipment/i);
    await expectNoAiRail(page, /AI equipment rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Equipment/i }),
    ).toHaveCount(0);

    await gotoAppRoute(page, "/import");
    await expectPageReady(page, /Import/i);
    await expectNoAiRail(page, /AI import rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Data Imports/i }),
    ).toHaveCount(0);

    await gotoAppRoute(page, "/rapsodo");
    await expectPageReady(page, /Rapsodo/i);
    await expectNoAiRail(page, /AI Rapsodo rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Data Imports/i }),
    ).toHaveCount(0);

    await gotoAppRoute(page, "/providers");
    await expectPageReady(page, /Providers/i);
    await expectNoAiRail(page, /AI provider rail/i);
    await expect(page.getByText(/Provider import health/i).first()).toBeVisible();
    await expect(page.getByText(/live\/current/i).first()).toBeVisible();
    await expect(page.getByText(/beta adapter/i).first()).toBeVisible();
    await expect(page.getByText(/research adapter/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Data Imports/i }),
    ).toHaveCount(0);

    await gotoAppRoute(page, "/courses");
    await expectPageReady(page, /AI course rail/i);
    await expectNoAiRail(page, /AI course rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Courses/i }),
    ).toBeVisible();

    await gotoAppRoute(page, "/course-records");
    await expectAppText(page, /AI course records rail/i, 45_000);
    await expectNoAiRail(page, /AI course records rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Courses/i }),
    ).toBeVisible();

    for (const route of [
      { path: "/tournaments", ready: /Tournaments/i, rail: /AI tournament rail/i },
      { path: "/challenges", ready: /Challenges/i, rail: /AI challenge rail/i },
      { path: "/leaderboard", ready: /Leaderboard/i, rail: /AI leaderboard rail/i },
      { path: "/feed", ready: /Feed/i, rail: /AI feed rail/i },
      { path: "/friends", ready: /Friends/i, rail: /AI friend rail/i },
      { path: "/groups", ready: /Groups/i, rail: /AI group rail/i },
      { path: "/profile", ready: /Profile/i, rail: /AI profile rail/i },
      {
        path: "/achievements",
        ready: /Achievements|Progress worth tracking/i,
        rail: /AI achievement rail/i,
      },
    ]) {
      await gotoAppRoute(page, route.path);
      await expectPageReady(page, route.ready);
      await expectNoAiRail(page, route.rail);
    }

    await gotoAppRoute(page, "/progress");
    await expectPageReady(page, /Bag progress|Overall progress/i);
    await expectNoAiRail(page, /AI progress rail/i);
    await expect(page.getByText(/AI progress workbench/i)).toBeHidden();
    const progressTrendRegion = page.getByRole("region", {
      name: /Progress trends chart accessibility/i,
    });
    await expect(progressTrendRegion).toBeVisible();
    await expect(
      progressTrendRegion.getByRole("link", { name: /Explain Progress trends chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await page.locator("summary", { hasText: /View Progress trends chart data table/i }).click();
    await expect(
      progressTrendRegion.getByRole("table", { name: /Progress trends chart data table/i }),
    ).toBeVisible();

    await gotoAppRoute(page, "/strokes-gained");
    await expectPageReady(page, /AI strokes-gained rail/i);
    await expectNoAiRail(page, /AI strokes-gained rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Progress/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /Strokes gained waterfall chart accessibility/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: /Strokes gained waterfall chart accessibility/i })
        .getByRole("link", { name: /Explain Strokes gained waterfall chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await page
      .locator("summary", { hasText: /View Strokes gained waterfall chart data table/i })
      .click();
    await expect(
      page.getByRole("table", { name: /Strokes gained waterfall chart data table/i }),
    ).toBeVisible();

    await gotoAppRoute(page, "/compare");
    await expectPageReady(page, /Compare/i);
    await expectNoAiRail(page, /AI compare rail/i);

    await gotoAppRoute(page, "/rounds");
    await expectPageReady(page, /AI round rail/i);
    await expectNoAiRail(page, /AI round rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Rounds/i }),
    ).toBeVisible();

    await gotoAppRoute(page, "/bag");
    await expectPageReady(page, /Bag|Gapping/i);
    await expectNoAiRail(page, /AI bag rail/i);

    await gotoAppRoute(page, "/coach");
    await expectPageReady(page, /AI coach rail/i);
    await expectNoAiRail(page, /AI coach rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Coach/i }),
    ).toBeVisible();
  });

  test("dense AI rails defer until large desktop workspaces stay readable", async ({ page }) => {
    skipWhenNoDesktopAuth();
    test.setTimeout(180_000);

    const denseRoutes = [
      {
        path: "/bag",
        scope: "bag",
        ready: /Bag|Gapping/i,
        rail: /AI bag rail/i,
        railWidth: 2048,
      },
      {
        path: "/progress",
        scope: "progress",
        ready: /Bag progress|Overall progress/i,
        rail: /AI progress rail/i,
        railWidth: 2048,
      },
      {
        path: "/compare",
        scope: "compare",
        ready: /Compare/i,
        rail: /AI compare rail/i,
        railWidth: 2300,
      },
    ];

    for (const route of denseRoutes) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAppRoute(page, route.path);
      await expectAppText(page, route.ready, 45_000);
      await expectDenseRouteReady(page, route.scope);
      await expectNoAiRail(page, route.rail);
      await expectNoHorizontalOverflow(page, `1440 ${route.path}`);
      await expectNoCrampedWorkbenchText(page, route.scope, `1440 ${route.path}`);

      if (route.railWidth > 2048) {
        await page.setViewportSize({ width: 2048, height: 1100 });
        await gotoAppRoute(page, route.path);
        await expectAppText(page, route.ready, 45_000);
        await expectDenseRouteReady(page, route.scope);
        await expectNoAiRail(page, route.rail);
        await expectNoHorizontalOverflow(page, `2048 ${route.path}`);
        await expectNoCrampedWorkbenchText(page, route.scope, `2048 ${route.path}`);
      }

      await page.setViewportSize({ width: route.railWidth, height: 1100 });
      await gotoAppRoute(page, route.path);
      await expectAppText(page, route.ready, 45_000);
      await expectDenseRouteReady(page, route.scope);
      await expect(page.getByRole("complementary", { name: route.rail })).toBeVisible();
      await expectNoHorizontalOverflow(page, `${route.railWidth} ${route.path}`);
      await expectNoCrampedWorkbenchText(page, route.scope, `${route.railWidth} ${route.path}`);
    }
  });

  test("small-laptop desktop routes avoid inline AI workbench slabs", async ({ page }) => {
    skipWhenNoDesktopAuth();
    test.setTimeout(240_000);

    await page.setViewportSize({ width: 1024, height: 768 });

    const routes = [
      { path: "/dashboard", ready: /Quick answers/i },
      { path: "/today", ready: /Best performer|Practice score/i },
      { path: "/progress", ready: /Bag progress|Overall progress/i },
      { path: "/practice", ready: /Practice Planner/i },
      { path: "/speed", ready: /Speed Centre|Speed/i },
      { path: "/stats/training-over-time", ready: /Training Load/i },
      { path: "/equipment", ready: /My Bag|Equipment/i },
      { path: "/rounds?filter=scorecard-only", ready: /Round history|Rounds/i },
      { path: "/bag", ready: /Bag|Gapping/i },
      { path: "/strokes-gained", ready: /Strokes gained|scoring/i },
      { path: "/compare", ready: /Compare/i },
      { path: "/courses", ready: /Course directory|Courses/i },
      { path: "/course-records", ready: /Course records/i },
      { path: "/tournaments", ready: /Tournaments/i },
      { path: "/challenges", ready: /Challenges/i },
      { path: "/leaderboard", ready: /Leaderboard/i },
      { path: "/feed", ready: /Feed/i },
      { path: "/friends", ready: /Friends/i },
      { path: "/groups", ready: /Groups/i },
      { path: "/profile", ready: /Profile/i },
      { path: "/achievements", ready: /Achievements|Progress worth tracking/i },
      { path: "/import", ready: /Import/i },
      { path: "/rapsodo", ready: /Rapsodo/i },
      { path: "/providers", ready: /Providers/i },
      { path: "/data-chat", ready: /AI data rail|Ask ForeKingHell/i },
    ];

    for (const route of routes) {
      await gotoAppRoute(page, route.path);
      await expectAppText(page, route.ready, 45_000);
      await expect(page.locator("main").getByText(/AI .* workbench/i)).toHaveCount(0);
    }
  });

  test("speed session detail uses the desktop workbench shell without an AI rail", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/speed");
    await expectPageReady(page, /Speed Centre|Speed/i);

    const sessionHref = await page
      .locator('a[href^="/speed/sessions/"]')
      .evaluateAll((links) =>
        links
          .map((link) => link.getAttribute("href") ?? "")
          .find((href) => /^\/speed\/sessions\/[^/?#]+/.test(href)),
      );
    expect(sessionHref).toBeTruthy();

    await gotoAppRoute(page, sessionHref as string);
    await expectAppText(page, /Swing detail|Speed session/i, 45_000);
    await expect(page.locator('[data-workbench-scope="speed-session"]')).toBeVisible();
    await expectNoAiRail(page, /AI speed rail/i);

    const swingLog = page.locator('[data-workbench-scope="speed-session-swings"]');
    if ((await swingLog.count()) > 0) {
      await expect(swingLog).toBeVisible();
      await expect(
        page.getByRole("table", { name: /Speed session swing log table/i }),
      ).toBeVisible();
    } else {
      await expect(page.getByText(/No individual swings/i)).toBeVisible();
    }

    await expectNoHorizontalOverflow(page, "speed session detail");
    await expectNoCrampedWorkbenchText(page, "speed-session", "speed session detail");
  });

  test("core workbench routes fit the desktop viewport matrix", async ({ page }) => {
    skipWhenNoDesktopAuth();
    test.setTimeout(420_000);

    for (const viewport of desktopMatrixViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const route of desktopMatrixRoutes) {
        await gotoAppRoute(page, route.path);
        await expectAppText(page, route.ready, 45_000);
        await expectNoHorizontalOverflow(page, `${viewport.name} ${route.path}`);
      }
    }
  });

  test("training load charts expose summaries and data table fallbacks", async ({ page }) => {
    skipWhenNoDesktopAuth();

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAppRoute(page, "/stats/training-over-time");
    await expectAppText(page, /Training Load/i, 45_000);
    await expectNoAiRail(page, /AI training rail/i);

    const trendRegion = page.getByRole("region", {
      name: /Training over time chart accessibility/i,
    });
    await expect(trendRegion).toBeVisible();
    await expect(trendRegion.locator('[data-chart-summary="Training over time"]')).toContainText(
      /Latest golf form|No training-over-time points/i,
    );
    await expect(
      trendRegion.getByRole("link", { name: /Explain Training over time chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await trendRegion
      .locator("summary", { hasText: /View Training over time chart data table/i })
      .click();
    await expect(
      trendRegion.getByRole("table", { name: /Training over time chart data table/i }),
    ).toBeVisible();

    const loadRegion = page.getByRole("region", {
      name: /Training load bars chart accessibility/i,
    });
    await expect(loadRegion).toBeVisible();
    await expect(loadRegion.locator('[data-chart-summary="Training load bars"]')).toContainText(
      /Latest visible load|No training-load bars/i,
    );
    await expect(
      loadRegion.getByRole("link", { name: /Explain Training load bars chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await loadRegion
      .locator("summary", { hasText: /View Training load bars chart data table/i })
      .click();
    await expect(
      loadRegion.getByRole("table", { name: /Training load bars chart data table/i }),
    ).toBeVisible();

    await expectNoHorizontalOverflow(page, "training load chart accessibility");
  });

  test("platform, simulator, safety and admin pages use selective desktop rails", async ({
    page,
  }) => {
    skipWhenNoDesktopAuth();
    test.setTimeout(240_000);

    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAppRoute(page, "/simulator-lab");
    await expectAppText(page, /Simulator Lab/i, 45_000);
    await expectNoAiRail(page, /AI simulator rail/i);
    await expect(
      page.getByRole("button", { name: /Open AI assistant for Simulator Lab/i }),
    ).toHaveCount(0);
    const simulatorMatrixRegion = page.getByRole("region", {
      name: /Simulator gapping matrix chart accessibility/i,
    });
    await expect(simulatorMatrixRegion).toBeVisible();
    await expect(
      simulatorMatrixRegion.getByRole("link", { name: /Explain Simulator gapping matrix chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await simulatorMatrixRegion
      .locator("summary", { hasText: /View Simulator gapping matrix chart data table/i })
      .click();
    await expect(
      simulatorMatrixRegion.getByRole("table", {
        name: /Simulator gapping matrix chart data table/i,
      }),
    ).toBeVisible();

    await gotoAppRoute(page, "/handicap");
    await expectAppText(page, /Handicap/i, 45_000);
    await expectNoAiRail(page, /AI handicap rail/i);
    await expect(page.getByRole("button", { name: /Open AI assistant for Handicap/i })).toHaveCount(
      0,
    );
    const handicapTrendRegion = page
      .getByRole("region", { name: /Handicap trend chart accessibility/i })
      .filter({ visible: true });
    await expect(handicapTrendRegion).toBeVisible();
    await expect(
      handicapTrendRegion.getByRole("link", { name: /Explain Handicap trend chart/i }),
    ).toHaveAttribute("href", /visible%20ForeKingHell%20chart%20summary/i);
    await handicapTrendRegion
      .locator("summary", { hasText: /View Handicap trend chart data table/i })
      .click();
    await expect(
      handicapTrendRegion.getByRole("table", { name: /Handicap trend chart data table/i }),
    ).toBeVisible();

    await gotoAppRoute(page, "/settings");
    await expectAppText(page, /Settings/i, 45_000);
    await expectNoAiRail(page, /AI settings rail/i);

    await gotoAppRoute(page, "/billing");
    await expectAppText(page, /Choose the plan|Pricing/i, 45_000);
    await expectNoAiRail(page, /AI billing rail/i);

    await gotoAppRoute(page, "/social-intelligence");
    await expectAppText(page, /Recaps & Safety/i, 45_000);
    await expectNoAiRail(page, /AI safety rail/i);
    await expect(page.getByRole("button", { name: /^Report$/i })).toHaveAttribute(
      "data-confirm-message",
      /Submit this social report/i,
    );

    await gotoAppRoute(page, "/admin");
    await expectAppText(page, /Operating pages|Admin/i, 45_000);
    await expectNoAiRail(page, /AI admin rail/i);

    await gotoAppRoute(page, "/admin/system-checks");
    await expectAppText(page, /Provider health and platform checks/i, 45_000);
    await expectNoAiRail(page, /AI admin rail/i);
    await expect(page.getByRole("link", { name: /Open provider console/i })).toHaveAttribute(
      "href",
      "/providers#provider-health",
    );
    await expect(page.getByRole("link", { name: /Review provider jobs/i })).toHaveAttribute(
      "href",
      "/providers#provider-jobs",
    );
    await expect(page.locator("[data-main-table-target='true']")).toHaveAttribute(
      "aria-label",
      "Admin system checks table",
    );
    await expect(
      page.locator('table[data-workbench-export-table="admin-system-checks"]'),
    ).toBeVisible();
    await page.getByRole("button", { name: /Columns/i }).click();
    await page.getByRole("menuitemcheckbox", { name: /Impact/i }).click();
    await expect(page.locator('th[data-column="impact"]')).toBeHidden();
    await page.keyboard.press("Escape");
    const [systemChecksDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Export$/i }).click(),
    ]);
    expect(systemChecksDownload.suggestedFilename()).toBe(
      "forekinghell-admin-system-checks.csv",
    );

    await page.setViewportSize({ width: 2048, height: 1100 });
    await gotoAppRoute(page, "/admin");
    await expectAppText(page, /AI admin rail/i, 45_000);
    await expect(page.getByRole("complementary", { name: /AI admin rail/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Generate admin report/i }).first()).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });

    await gotoAppRoute(page, "/partners");
    await expectAppText(page, /Sponsors and partner offers/i, 45_000);
    await expectNoAiRail(page, /AI partner rail/i);

    await gotoAppRoute(page, "/admin/users");
    await expectAppText(page, /Users and access/i, 45_000);
    await expect(page.getByRole("table", { name: /Admin user accounts/i })).toBeVisible();

    await gotoAppRoute(page, "/admin/billing");
    await expectAppText(page, /Billing and entitlements/i, 45_000);
    await expect(page.getByRole("table", { name: /Admin subscription rows/i })).toBeVisible();

    await gotoAppRoute(page, "/admin/moderation");
    await expectAppText(page, /Moderation queue/i, 45_000);
    await expect(page.getByText("User reports", { exact: true })).toBeVisible();

    await gotoAppRoute(page, "/admin/challenges");
    await expectAppText(page, /Challenges and tournaments/i, 45_000);
    await expect(page.getByRole("table", { name: /Admin challenge boards/i })).toBeVisible();
  });
});

function skipWhenNoDesktopAuth() {
  test.skip(
    !hasAuthBypass && !useAuthStorage,
    "Set PLAYWRIGHT_AUTH_STATE or PLAYWRIGHT_E2E_AUTH_BYPASS=1 to run desktop workbench flows.",
  );
}

function createPlaywrightBypassCookie() {
  const token = [
    base64UrlJson({ alg: "none", typ: "JWT" }),
    base64UrlJson({
      sub: "c0c02d1e-605a-47c5-a023-83a1c0d18195",
      email: "playwright@forekinghell.local",
      user_metadata: { name: "Playwright" },
    }),
    "playwright",
  ].join(".");

  return {
    name: "sb-playwright-auth-token",
    value: encodeURIComponent(JSON.stringify({ access_token: token })),
    domain: baseUrl.hostname,
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 60 * 60,
    httpOnly: false,
    secure: false,
    sameSite: "Lax" as const,
  };
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function gotoAppRoute(page: Page, path: string) {
  try {
    await page.goto(path, { waitUntil: "commit", timeout: 45_000 });
  } catch (error) {
    const message = String(error);
    if (
      !message.includes("net::ERR_ABORTED") &&
      !message.includes("net::ERR_NETWORK_IO_SUSPENDED") &&
      !message.includes("net::ERR_CONNECTION_REFUSED") &&
      !message.includes("net::ERR_CONNECTION_RESET")
    ) {
      throw error;
    }
    if (
      message.includes("net::ERR_CONNECTION_REFUSED") ||
      message.includes("net::ERR_CONNECTION_RESET")
    ) {
      await page.waitForTimeout(1_000);
    }
    await page.goto(path, { waitUntil: "commit", timeout: 45_000 });
  }

  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

async function expectAppText(page: Page, expectedText: RegExp | string, timeout = 10_000) {
  try {
    await expect(page.locator("body")).toContainText(expectedText, { timeout });
  } catch (error) {
    if (page.isClosed()) {
      throw error;
    }

    await page.reload({ waitUntil: "commit", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await expect(page.locator("body")).toContainText(expectedText, { timeout });
  }
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function waitForHref(
  page: Page,
  selector: string,
  pattern: string,
  excludedHrefs: string[] = [],
) {
  await expect
    .poll(
      async () =>
        page.locator(selector).evaluateAll(
          (links, input) => {
            const matcher = new RegExp(input.pattern);
            const excluded = new Set(input.excludedHrefs);

            return (
              links
                .map((link) => link.getAttribute("href") ?? "")
                .find((href) => matcher.test(href) && !excluded.has(href)) ?? ""
            );
          },
          { pattern, excludedHrefs },
        ),
      { timeout: 45_000 },
    )
    .not.toBe("");

  return page.locator(selector).evaluateAll(
    (links, input) => {
      const matcher = new RegExp(input.pattern);
      const excluded = new Set(input.excludedHrefs);

      return (
        links
          .map((link) => link.getAttribute("href") ?? "")
          .find((href) => matcher.test(href) && !excluded.has(href)) ?? null
      );
    },
    { pattern, excludedHrefs },
  );
}

async function expectDenseRouteReady(page: Page, scope: string) {
  if (scope === "bag") {
    await expect(page.getByRole("table", { name: /Full bag gapping table/i })).toBeVisible({
      timeout: 45_000,
    });
    return;
  }

  if (scope === "progress") {
    await expect(
      page.getByRole("region", { name: /Progress trends chart accessibility/i }),
    ).toBeVisible({ timeout: 45_000 });
    return;
  }

  if (scope === "compare") {
    await expect(page.locator('[data-workbench-scope="club-comparison-metrics"]')).toBeVisible({
      timeout: 45_000,
    });
  }
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewportWidth: window.innerWidth,
  }));

  expect(metrics.scrollWidth, `${label} should not horizontally overflow`).toBeLessThanOrEqual(
    metrics.viewportWidth + 2,
  );
}

async function expectNoCrampedWorkbenchText(page: Page, scope: string, label: string) {
  const crampedNodes = await page.evaluate((workbenchScope) => {
    const root =
      document.querySelector(`[data-workbench-scope="${workbenchScope}"]`) ??
      document.querySelector("main") ??
      document.body;

    return Array.from(root.querySelectorAll("h1, h2, h3, p, span, a, button, th, td"))
      .filter((node) => Boolean(node.getClientRects().length))
      .map((node) => {
        const text = (node.textContent ?? "").trim().replace(/\s+/g, " ");
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const lineHeight = Number.parseFloat(style.lineHeight) || 20;

        return {
          text,
          width: rect.width,
          height: rect.height,
          lineHeight,
        };
      })
      .filter(
        ({ text, width, height, lineHeight }) =>
          text.length > 18 && width > 0 && width < 92 && height > lineHeight * 3.2,
      )
      .slice(0, 8);
  }, scope);

  expect(crampedNodes, `${label} should not contain skinny stacked desktop text`).toEqual([]);
}

async function expectNoAiRail(page: Page, railName: RegExp) {
  await expect(page.getByRole("complementary", { name: railName })).toHaveCount(0);
}

function collectHydrationWarnings(page: Page) {
  const warnings: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    if (/hydrated|hydration|server rendered HTML/i.test(text)) {
      warnings.push(text);
    }
  });

  return warnings;
}

function extractSupabaseUserId(storageStatePath: string) {
  if (!existsSync(storageStatePath)) {
    return null;
  }

  const state = JSON.parse(readFileSync(storageStatePath, "utf8")) as {
    cookies?: Array<{ name: string; value: string }>;
  };
  const cookie = state.cookies?.find(
    (item) => item.name.startsWith("sb-") && item.name.endsWith("-auth-token"),
  );
  if (!cookie) {
    return null;
  }

  try {
    let value = decodeURIComponent(cookie.value);
    if (value.startsWith("base64-")) {
      value = Buffer.from(value.slice("base64-".length), "base64").toString("utf8");
    }
    const parsed = JSON.parse(value) as { access_token?: string } | [string];
    const token = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
    if (!token) {
      return null;
    }

    const [, payload] = token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string;
    };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}

async function expectWorkbenchRowKeyboardNavigation(page: Page, tableSelector: string) {
  const rows = page.locator(`${tableSelector} tbody tr[tabindex]`);

  await expect(rows.nth(1)).toBeVisible();
  await rows.first().focus();
  await expect.poll(() => activeWorkbenchRowIndex(page, tableSelector)).toBe(0);

  await page.keyboard.press("ArrowDown");
  await expect.poll(() => activeWorkbenchRowIndex(page, tableSelector)).toBe(1);

  await page.keyboard.press("End");
  const lastIndex = await rows.count().then((count) => count - 1);
  await expect.poll(() => activeWorkbenchRowIndex(page, tableSelector)).toBe(lastIndex);

  await page.keyboard.press("Home");
  await expect.poll(() => activeWorkbenchRowIndex(page, tableSelector)).toBe(0);
}

async function activeWorkbenchRowIndex(page: Page, tableSelector: string) {
  return page.evaluate((selector) => {
    const rows = Array.from(document.querySelectorAll(`${selector} tbody tr[tabindex]`));
    return rows.findIndex((row) => row === document.activeElement);
  }, tableSelector);
}
