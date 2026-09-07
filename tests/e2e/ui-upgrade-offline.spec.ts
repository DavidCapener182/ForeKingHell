import { expect, test } from "@playwright/test";
import { createQuickBagSnapshot } from "../../src/lib/quick-bag-snapshot";
import { mobileQuickBagClub } from "../../src/lib/mobile-quick-bag-evidence";

test("Offline resources show only owned copies and preserve local round context", async ({
  page,
  context,
}, info) => {
  test.skip(
    process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" || info.project.name !== "chromium",
  );
  test.setTimeout(240000);
  const account = "ui-offline-owned";
  const round = {
    context: {
      sessionId: "offline-ui-round",
      course: "Synthetic saved course",
      tee: "Yellow",
      courseId: "course",
    },
    version: "record-v1",
    index: 0,
    dirty: [7],
    inFlight: null,
    holes: [
      {
        holeNumber: 7,
        par: 4,
        yards: 401,
        score: 5,
        putts: 2,
        penalties: 0,
        fairwayHit: null,
        gir: false,
      },
    ],
  };
  const bag = createQuickBagSnapshot(
    account,
    [mobileQuickBagClub({ id: "club", type: "7i", brand: null, model: null }, [])],
    "2026-09-05T09:00:00.000Z",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(navigator, "onLine", { get: () => false }));
  await page.goto("/offline", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(
    ({ account, round, bag }) => {
      localStorage.setItem("fkh:offline-account", account);
      localStorage.setItem(`fkh:live-round:${account}:offline-ui-round`, JSON.stringify(round));
      localStorage.setItem(
        "fkh:live-round:foreign:secret",
        JSON.stringify({
          ...round,
          context: { ...round.context, sessionId: "secret", course: "Foreign secret course" },
        }),
      );
      localStorage.setItem(`fkh:quick-bag:${account}`, JSON.stringify(bag));
      localStorage.setItem(`fkh:quick-range:${account}`, JSON.stringify({ state: "active" }));
    },
    { account, round, bag },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Synthetic saved course/ })).toBeVisible({
    timeout: 60000,
  });
  await page.route("**/api/offline/**", (route) => route.abort());
  await page.route("**/assets/connection.txt?*", (route) => route.abort());
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByText("Foreign secret course", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Quick Range/ })).toHaveCount(0);
    await expect(page.getByText(/saved time not recorded/)).toBeVisible();
    await expect(page.getByText(/2 clubs/)).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Mobile primary — saved content" }).getByRole("button"),
    ).toHaveCount(5);
    await page.getByRole("button", { name: "Find saved resources", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search saved resources" }).fill("Synthetic");
    await expect(
      page.getByRole("dialog").getByRole("button", { name: /Synthetic saved course/ }),
    ).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: /Quick Bag/ })).toHaveCount(
      0,
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.locator('[data-slot="drawer-overlay"], [data-slot="sheet-overlay"]'),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Reconnect and open app", exact: true }).click();
    await expect(page.getByText(/Still unable to reach/)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/offline$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath(`P87-saved-${width}.png`) });
  }
  await page.getByRole("button", { name: /Synthetic saved course/ }).click();
  await expect(page).toHaveURL(/sessionId=offline-ui-round/);
  await expect(page.locator("[data-mobile-live-round]")).toBeVisible({ timeout: 20000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-mobile-live-round]")).toBeVisible({ timeout: 60000 });
  const restored = await page.evaluate(
    (account) => JSON.parse(localStorage.getItem(`fkh:live-round:${account}:offline-ui-round`)!),
    account,
  );
  expect(restored.holes[0].score).toBe(5);
  expect(restored.dirty).toContain(7);
  await page.evaluate(() => {
    localStorage.setItem("fkh:offline-account", "different");
    window.dispatchEvent(new Event("storage"));
  });
  await expect(page.getByText(/account on this device changed/)).toBeVisible();
  await expect(page.locator("[data-mobile-live-round]")).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.clearCookies();
});
