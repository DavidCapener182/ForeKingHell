import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("synthetic benchmark intelligence: modes, honest cohorts, keyboard and responsive access", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Explicit four-width Chromium acceptance matrix");
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/benchmark-intelligence.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [
      {
        name: "read-only-fixture-boundaries",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/club-progress-navigation.ts"),
          }));
          builder.onResolve(
            { filter: /app\/(?:\(app\)\/shots\/actions|sessions\/confidence-actions)$/ },
            () => ({
              path: "shot-actions",
              namespace: "fixture",
            }),
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: [
              "saveSessionConfidence",
              "correctShotClubAction",
              "correctShotsClubAction",
              "reviewShotsAction",
              "excludeShotAction",
              "restoreShotAction",
              "deleteShotAction",
              "deleteShotsAction",
              "keepAutomaticShotReviewAction",
            ]
              .map(
                (name) =>
                  `export async function ${name}() { throw new Error("Synthetic fixture server actions are disabled"); }`,
              )
              .join("\n"),
            loader: "js",
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://benchmark-intelligence.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Synthetic benchmark intelligence acceptance fixture</title></head><body style="font-family:system-ui,sans-serif"><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error("Fixture browser error:", error.message);
  });
  mkdirSync("output/benchmark-intelligence", { recursive: true });
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("https://benchmark-intelligence.fixture/bag");
    await page.addStyleTag({ content: css.css });
    for (const file of bundle.outputFiles.filter((file) => file.path.endsWith(".css")))
      await page.addStyleTag({ content: file.text });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    await page.waitForLoadState("networkidle");
    const view = page.getByRole("group", { name: "Benchmark view" });
    await expect(view.getByRole("button", { name: "Benchmarks", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Best 30 avg", exact: true })).toHaveAttribute(
      "data-state",
      "active",
    );
    await expect(page.locator("main")).toContainText("SYNTHETIC ACCEPTANCE FIXTURE");
    await expect(page.locator("main")).toContainText("Beg 180");
    await expect(page.locator("main")).toContainText("Advanced");
    await page.getByRole("tab", { name: "Club speed", exact: true }).click();
    await expect(page.locator("main")).toContainText("18 valid / 30 selected");
    await expect(page.locator("main")).toContainText("12 measured · 6 estimated");
    await expect(page.locator("main")).toContainText(
      "Stored readings excluded: metric provenance does not support comparison.",
    );
    await page.getByRole("tab", { name: "Height", exact: true }).click();
    await expect(page.locator("main")).toContainText("Needs comparable height");
    await expect(page.locator("main")).toContainText(
      "Stored height excluded: units or provenance do not support comparison.",
    );
    await expect(page.locator("main")).toContainText("12 numeric readings excluded");
    if (width < 640) {
      const height = page.getByRole("region", { name: "Max height by club", exact: true });
      await height.getByRole("button", { name: "Next slide", exact: true }).click();
      const card = height.locator('[data-slot="carousel-item"]').last();
      await expect(card).toContainText("Stored height excluded");
      await expect
        .poll(async () => {
          const frame = await height.locator('[data-slot="carousel-content"]').boundingBox();
          const bounds = await card.locator(":scope > *").first().boundingBox();
          return (
            !!frame &&
            !!bounds &&
            bounds.x >= frame.x - 1 &&
            bounds.x + bounds.width <= frame.x + frame.width + 1
          );
        })
        .toBe(true);
      expect(
        await card
          .locator("p,[data-slot=badge]")
          .evaluateAll((elements) =>
            elements
              .filter((element) => element.scrollWidth > element.clientWidth + 1)
              .map((element) => element.textContent),
          ),
      ).toEqual([]);
    }

    await view.getByRole("button", { name: "Benchmarks", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(view.getByRole("button", { name: "Current form", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    const panel = page.locator("[data-performance-intelligence]").first();
    await expect(panel).toContainText("Potential carry");
    await expect(panel).toContainText("220.0");
    await expect(panel).toContainText("180.0");
    await expect(
      panel.getByRole("figure", { name: "Actual all-attempt carry distribution" }),
    ).toBeVisible();
    await expect(panel).toContainText("60 valid intended attempts");
    await expect(panel).toContainText("55 stock shots");
    const select = panel.getByLabel("Comparable evidence");
    await expect(select.locator("option")).toHaveCount(3);
    await expect(select.locator("option").first()).toContainText("Driver");
    await select.selectOption("1");
    await expect(panel).toContainText("240.0");
    await expect(panel).toContainText("200.0");
    await select.selectOption("0");
    await panel.getByText("Evidence and methodology", { exact: true }).click();
    await expect(panel).toContainText("Explicit severe mishit");
    await expect(panel).toContainText("90 days");
    await panel.getByText("Metric comparison and coverage", { exact: true }).click();
    await expect(
      panel.getByRole("region", { name: "Current and baseline metric comparison" }),
    ).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/benchmark-intelligence/synthetic-current-${width}.png`,
      fullPage: true,
    });
    await view.getByRole("button", { name: "Coaching", exact: true }).click();
    await expect(panel).toContainText("One next practice action");
    await expect(panel).toContainText("Success criterion");
    await expect(panel.getByRole("link", { name: "Build practice" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "View supporting shots" })).toBeVisible();
    await expect(panel.getByRole("link", { name: "View supporting shots" })).toHaveAttribute(
      "href",
      "/shots?club=driver",
    );
    await expect(panel.getByRole("link", { name: "Build practice" })).toHaveAttribute(
      "href",
      "/practice/quick-range?club=driver",
    );
    await expect(panel.getByRole("link", { name: "Speed development" })).toHaveAttribute(
      "href",
      "/speed",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/benchmark-intelligence/synthetic-coaching-${width}.png`,
      fullPage: true,
    });
    await view.getByRole("button", { name: "Benchmarks", exact: true }).click();
    await page.getByRole("tab", { name: "Land", exact: true }).click();
    await expect(page.locator("main")).toContainText(
      "Above Tour reference; not necessarily a better flight",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/benchmark-intelligence/synthetic-benchmarks-${width}.png`,
      fullPage: true,
    });
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("https://benchmark-intelligence.fixture/club");
    await page.addStyleTag({ content: css.css });
    for (const file of bundle.outputFiles.filter((file) => file.path.endsWith(".css")))
      await page.addStyleTag({ content: file.text });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    await page.waitForLoadState("networkidle");
    const context = page.getByLabel("Club evidence context");
    await expect(context.locator("option")).toHaveCount(2);
    const stock = page.getByText("Stock carry", { exact: true }).first().locator("..");
    const initialCarry = Number((await stock.innerText()).match(/(\d+(?:\.\d+)?)\s*yd/)?.[1]);
    expect(initialCarry).toBe(180);
    await expect(page.getByText("102 saved shots in this range", { exact: false })).toBeVisible();
    const optionB = await context
      .locator("option")
      .filter({ hasText: "Synthetic monitor B" })
      .getAttribute("value");
    await context.selectOption(optionB!);
    await expect
      .poll(async () => Number((await stock.innerText()).match(/(\d+(?:\.\d+)?)\s*yd/)?.[1]))
      .toBe(initialCarry + 20);
    await expect(page.getByText("102 saved shots in this range", { exact: false })).toBeVisible();
    const contextValue = await context.inputValue();
    await page.getByRole("button", { name: /Shot date range/ }).click();
    await page.getByRole("option", { name: "Last month", exact: true }).click();
    await expect(context).toHaveValue(contextValue);
    const rangedCarry = Number((await stock.innerText()).match(/(\d+(?:\.\d+)?)\s*yd/)?.[1]);
    expect(rangedCarry).toBe(200);
    await expect(page.getByText("72 saved shots in this range", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/benchmark-intelligence/synthetic-selected-club-context-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
