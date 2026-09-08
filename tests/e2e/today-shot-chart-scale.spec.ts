import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test, type Locator, type Page } from "@playwright/test";

let fixtureScript: string;
let fixtureStyle: string;

test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/today-shot-charts.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "next/navigation": path.resolve("tests/fixtures/ui-upgrade/rapsodo-navigation.tsx"),
    },
    plugins: [
      {
        name: "read-only-shot-actions",
        setup(builder) {
          builder.onResolve({ filter: /^@\/app\/\(app\)\/shots\/actions$/ }, () => ({
            path: "shot-actions",
            namespace: "fixture",
          }));
          builder.onResolve({ filter: /^@\/app\/sessions\/confidence-actions$/ }, () => ({
            path: "confidence-actions",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: `
              const reject = () => { throw new Error("This chart fixture must not mutate shots"); };
              export const correctShotClubAction = reject;
              export const deleteShotsAction = reject;
              export const excludeShotAction = reject;
              export const restoreShotAction = reject;
              export const reviewShotsAction = reject;
              export const saveSessionConfidence = reject;
            `,
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  fixtureScript = bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text;
  fixtureStyle =
    css.css +
    bundle.outputFiles
      .filter((file) => file.path.endsWith(".css"))
      .map((file) => file.text)
      .join("\n");
});

async function renderFixture(page: Page, query = "") {
  await page.route("https://today-shot-charts.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse" style="--font-ui-source:Arial;--font-body:Arial"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shot chart regression fixture</title></head><body><div id="root"></div></body></html>',
    }),
  );
  page.setDefaultTimeout(15_000);
  await page.goto(`https://today-shot-charts.fixture/${query}`);
  await page.addStyleTag({ content: fixtureStyle });
  await page.addScriptTag({ content: fixtureScript });
  await expect(page.locator("svg[aria-label*='dispersion chart']")).toBeVisible();
}

async function expectScale(chart: Locator, maxSide: number, fixedTarget = true) {
  await expect(chart).toHaveAttribute("data-dispersion-max-side", String(maxSide));
  await expect(chart).toHaveAttribute("data-dispersion-max-carry", "300");
  if (fixedTarget) await expect(chart).toHaveAttribute("data-dispersion-target-side", "10");
}

async function landingPosition(point: Locator) {
  return point.evaluate((node) => {
    const circle = node instanceof SVGCircleElement ? node : node.querySelector("circle")!;
    return [Number(circle.getAttribute("cx")), Number(circle.getAttribute("cy"))];
  });
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
}

test("Today dispersion keeps its coordinate scale through club and outlier filters", async ({
  page,
}, info) => {
  test.skip(!["chromium", "webkit"].includes(info.project.name));
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });

  for (const wide of [false, true]) {
    await renderFixture(page, wide ? "?wide=1" : "");
    const chart = page.locator("svg[aria-label^='Interactive dispersion chart']");
    const point = chart.locator('[data-today-shot-point="driver-9"]');
    await expectScale(chart, wide ? 100 : 50);
    const originalLanding = await landingPosition(point);
    const clubFilters = page.getByRole("group", { name: "Shot chart club filters" });
    await clubFilters.getByRole("radio", { name: /^Driver/ }).click();
    await expect(chart.locator("[data-today-shot-point]")).toHaveCount(9);
    await expectScale(chart, wide ? 100 : 50);
    expect(await landingPosition(point)).toEqual(originalLanding);

    await point.focus();
    await point.press("Enter");
    await expect(page.locator('[data-today-selected-shot="driver-9"]')).toBeVisible();
    await expect(point).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Close selected shot details" }).click();
    await expect(page.locator("[data-today-selected-shot]")).toHaveCount(0);
    expect(await landingPosition(point)).toEqual(originalLanding);

    await page.screenshot({
      path: info.outputPath(`today-driver-filter-${wide ? "wide" : "standard"}.png`),
      fullPage: true,
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Show all clubs", exact: true }).click();
    await page.getByRole("button", { name: "Hide outliers", exact: true }).click();
    await expect(chart.locator('[data-today-shot-point="iron-9"]')).toHaveCount(0);
    await expectScale(chart, wide ? 100 : 50);
    expect(await landingPosition(point)).toEqual(originalLanding);
    await page.getByRole("button", { name: "Show outliers", exact: true }).click();
    await expect(chart.locator('[data-today-shot-point="iron-9"]')).toHaveCount(1);
    expect(await landingPosition(point)).toEqual(originalLanding);
    await expectNoOverflow(page);
  }
  expect(errors).toEqual([]);
});

test("Today portrait dispersion leaves a wider trajectory and fits narrow screens", async ({
  page,
}, info) => {
  test.skip(!["chromium", "webkit"].includes(info.project.name));
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const [width, height] of [
    [1440, 1000],
    [1280, 900],
    [1024, 900],
    [390, 844],
    [320, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await renderFixture(page);
    const dispersion = page.locator("svg[aria-label^='Interactive dispersion chart']");
    const trajectory = page.locator("svg[aria-label^='Interactive trajectory chart']");
    await expect(trajectory).toBeVisible();
    const viewBox = await dispersion.getAttribute("viewBox");
    const [, , chartWidth, chartHeight] = viewBox!.split(" ").map(Number);
    expect(chartHeight).toBeGreaterThan(chartWidth);
    const dispersionBox = (await dispersion.boundingBox())!;
    const trajectoryBox = (await trajectory.boundingBox())!;
    if (width >= 1280) {
      expect(trajectoryBox.x).toBeGreaterThan(dispersionBox.x + dispersionBox.width);
      expect(trajectoryBox.width).toBeGreaterThan(dispersionBox.width * 1.15);
    } else {
      expect(trajectoryBox.y).toBeGreaterThan(dispersionBox.y + dispersionBox.height);
    }
    await expectNoOverflow(page);
    await page.screenshot({
      path: info.outputPath(`today-shot-charts-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  expect(errors).toEqual([]);
});

test("Companion dispersion stays fixed when club and trusted-shot filters change", async ({
  page,
}, info) => {
  test.skip(!["chromium", "webkit"].includes(info.project.name));
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const wide of [false, true]) {
      await renderFixture(page, `?surface=companion${wide ? "&wide=1" : ""}`);
      const wrapper = page.locator("[data-mobile-dispersion-layout]");
      const chart = wrapper.locator("svg");
      const point = chart.getByRole("button", { name: "Driver shot 9", exact: true });
      await expectScale(wrapper, wide ? 100 : 50, false);
      const originalLanding = await landingPosition(point);
      const originalAxisLabels = await chart.locator("text").allTextContents();
      await page
        .getByRole("radiogroup", { name: "Chart club" })
        .getByRole("radio", { name: "Driver", exact: true })
        .click();
      await expectScale(wrapper, wide ? 100 : 50, false);
      expect(await landingPosition(point)).toEqual(originalLanding);
      expect(await chart.locator("text").allTextContents()).toEqual(originalAxisLabels);
      await point.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page
        .getByRole("radiogroup", { name: "Chart club" })
        .getByRole("radio", { name: "All clubs", exact: true })
        .click();
      await page
        .getByRole("radiogroup", { name: "Evidence trust" })
        .getByRole("radio", { name: "All shots", exact: true })
        .click();
      await expect(chart.getByRole("button", { name: "7 iron shot 18", exact: true })).toHaveCount(
        1,
      );
      await expectScale(wrapper, wide ? 100 : 50, false);
      expect(await landingPosition(point)).toEqual(originalLanding);
      const box = (await chart.boundingBox())!;
      expect(box.height).toBeGreaterThan(box.width);
      await expectNoOverflow(page);
      await page.screenshot({
        path: info.outputPath(`companion-shot-charts-${width}-${wide ? "wide" : "standard"}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  expect(errors).toEqual([]);
});
