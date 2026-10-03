import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("shared progress: instant controls, scope, preferences, gaps and responsive access", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Explicit phone/desktop and theme matrix");
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/club-progress.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [
      {
        name: "fixture-navigation",
        setup(build) {
          build.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/club-progress-navigation.ts"),
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://club-progress.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Shared progress UI test</title></head><body><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const mount = async (href: string) => {
    await page.goto(href);
    await page.addStyleTag({ content: css.css });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith(".js"))!.text,
    });
    await expect(page.locator("[data-club-progress]")).toBeVisible();
  };
  for (const width of [320, 390, 1440, 1920]) {
    for (const theme of ["clubhouse", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await mount("https://club-progress.fixture/today?cpMetric=carryYd");
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      const panel = page.locator("[data-club-progress]");
      await expect(panel).not.toContainText("Retired Club");
      await expect(panel.locator("[data-progress-cards]")).toContainText(
        "Previous reading unavailable",
      );
      const svg = panel.getByRole("img", { name: /session graph/ });
      await expect
        .poll(() =>
          svg.evaluate((element) => {
            const matrix = (element as SVGSVGElement).getScreenCTM()!;
            return Math.abs(matrix.a - matrix.d);
          }),
        )
        .toBeLessThan(0.01);
      const chart = panel.locator("[data-session-chart]");
      await expect
        .poll(() =>
          svg.evaluate((element) => {
            const svg = element as SVGSVGElement;
            return Math.abs(svg.viewBox.baseVal.width - svg.getBoundingClientRect().width);
          }),
        )
        .toBeLessThan(1);
      expect((await chart.boundingBox())!.height).toBeGreaterThanOrEqual(288);
      const graph = panel.locator("[data-session-path]");
      expect((await graph.getAttribute("d"))!.match(/M /g)?.length).toBe(2);
      const requests: string[] = [];
      const listener = (request: import("@playwright/test").Request) =>
        requests.push(request.url());
      page.on("request", listener);
      await panel.getByRole("tab", { name: "Accuracy", exact: true }).click();
      await expect(panel.locator("[data-progress-cards]")).toContainText("10.0 yd");
      await panel.getByRole("button", { name: "Last 20", exact: true }).click();
      await expect(panel.getByLabel("Inspect session points").getByRole("button")).toHaveCount(20);
      const plottedPoints = panel.locator("[data-session-point]");
      for (const index of [2, 10, 18]) {
        const plottedPoint = plottedPoints.nth(index);
        const date = (await plottedPoint.locator("title").textContent())!.split(": ")[0];
        await plottedPoint.scrollIntoViewIfNeeded();
        const bounds = (await plottedPoint.boundingBox())!;
        await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await expect(panel.locator("[data-inspected-session]")).toContainText(date);
      }
      await panel.getByRole("checkbox", { name: "3-session rolling average" }).check();
      await expect(panel.locator("[data-rolling-path]")).toHaveCount(1);
      await panel.getByLabel("Comparison upload", { exact: true }).selectOption("upload-21");
      await expect(panel.locator("[data-progress-cards]")).toContainText("21 Sept 2026");
      await panel
        .getByLabel("Whole-bag changes")
        .getByRole("button", { name: /Named Iron/ })
        .click();
      await expect(panel.getByRole("tab", { name: /Named Iron/ })).toHaveAttribute(
        "data-state",
        "active",
      );
      const cards = await panel.locator("[data-progress-cards]").innerText();
      const point = panel.getByLabel("Inspect session points").getByRole("button").first();
      await point.press("Tab");
      await point.press("Enter");
      await expect(panel.locator("[data-inspected-session]")).not.toContainText("21 Sept 2026");
      expect(await panel.locator("[data-progress-cards]").innerText()).toBe(cards);
      expect(requests).toEqual([]);
      page.off("request", listener);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      expect(
        await panel
          .getByRole("button", { name: "Last 20", exact: true })
          .evaluate((e) => e.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44);
      await page.screenshot({
        path: info.outputPath(`shared-progress-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  }
  await mount("https://club-progress.fixture/dashboard");
  let panel = page.locator("[data-club-progress]");
  await expect(panel.getByRole("tab", { name: "Accuracy", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(panel.getByRole("button", { name: "Last 20", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await panel.getByRole("tab", { name: "Carry", exact: true }).click();
  await panel.getByRole("tab", { name: "Ball speed", exact: true }).click();
  await page.goBack();
  await expect(panel.getByRole("tab", { name: "Carry", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
  await page.goForward();
  await expect(panel.getByRole("tab", { name: "Ball speed", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(panel).toContainText("equal-session trend");
  await mount("https://club-progress.fixture/today?cpClub=missing&cpMetric=carryYd");
  panel = page.locator("[data-club-progress]");
  await expect(panel).toContainText("requested club, context or session is unavailable");
  await expect(panel.locator("[data-progress-cards]")).toHaveCount(0);
  await page.evaluate(() =>
    localStorage.setItem("fkh:club-progress:v1:isolated-fixture", "malformed"),
  );
  await mount("https://club-progress.fixture/dashboard?cpMetric=totalYd&fixtureFailure=1");
  await expect(page.locator("[data-club-progress]")).toContainText("History loading failed");
  await expect(page.getByRole("button", { name: "Retry history" })).toBeVisible();
  expect(errors).toEqual([]);
});
