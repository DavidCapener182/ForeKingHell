import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import sharp from "sharp";
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
  await expect(page.locator("svg[aria-label*='dispersion chart' i]")).toBeVisible();
}

async function expectScale(chart: Locator, maxSide: number, fixedTarget = true, maxCarry = 240) {
  await expect(chart).toHaveAttribute("data-dispersion-max-side", String(maxSide));
  await expect(chart).toHaveAttribute("data-dispersion-max-carry", String(maxCarry));
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

async function pixelsPaintedAbovePlot(chart: Locator) {
  const band = await chart.evaluate((svg) => {
    const viewBox = (svg as SVGSVGElement).viewBox.baseVal;
    const grid = [...svg.querySelectorAll("line")].filter(
      (line) =>
        line.y1.baseVal.value === line.y2.baseVal.value &&
        line.x2.baseVal.value - line.x1.baseVal.value > viewBox.width / 2,
    );
    const top = Math.min(...grid.map((line) => line.y1.baseVal.value));
    return {
      left: Math.min(...grid.map((line) => line.x1.baseVal.value)) + 2,
      right: Math.max(...grid.map((line) => line.x2.baseVal.value)) - 2,
      top: top - 13,
      bottom: top - 3,
      width: viewBox.width,
      height: viewBox.height,
    };
  });
  const { data, info } = await sharp(await chart.screenshot({ animations: "disabled" }))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let painted = 0;
  for (
    let y = Math.ceil((band.top * info.height) / band.height);
    y < (band.bottom * info.height) / band.height;
    y++
  ) {
    for (
      let x = Math.ceil((band.left * info.width) / band.width);
      x < (band.right * info.width) / band.width;
      x++
    ) {
      const offset = (y * info.width + x) * info.channels;
      if (Math.min(data[offset], data[offset + 1], data[offset + 2]) < 250) painted++;
    }
  }
  return painted;
}

async function expectEllipsePaintClipped(chart: Locator) {
  const ellipses = chart.locator("ellipse");
  await expect(ellipses).toHaveCount(2);
  // Negative control: this actual distribution extends above the carry ceiling.
  const clips = await ellipses.evaluateAll((nodes) =>
    nodes.map((node) => {
      const clip = node.getAttribute("clip-path");
      node.removeAttribute("clip-path");
      return clip;
    }),
  );
  let unclippedPixels = 0;
  try {
    unclippedPixels = await pixelsPaintedAbovePlot(chart);
  } finally {
    await ellipses.evaluateAll(
      (nodes, paths) =>
        nodes.forEach((node, index) => {
          if (paths[index]) node.setAttribute("clip-path", paths[index]!);
        }),
      clips,
    );
  }
  expect(unclippedPixels).toBeGreaterThan(0);
  expect(await pixelsPaintedAbovePlot(chart)).toBe(0);
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
    const carryCeiling = wide ? 230 : 240;
    await renderFixture(page, wide ? "?wide=1&carry=224" : "");
    const chart = page.locator("svg[aria-label^='Interactive dispersion chart']");
    const trajectory = page.locator("svg[aria-label^='Interactive trajectory chart']");
    const point = chart.locator('[data-today-shot-point="driver-9"]');
    const ironPoint = chart.locator('[data-today-shot-point="iron-8"]');
    await expectScale(chart, wide ? 100 : 50, true, carryCeiling);
    await expect(trajectory).toHaveAttribute("data-trajectory-max-carry", String(carryCeiling));
    await expectEllipsePaintClipped(chart);
    const chartBox = (await chart.boundingBox())!;
    const longestShotBox = (await point.boundingBox())!;
    expect(longestShotBox.y).toBeLessThan(chartBox.y + chartBox.height * 0.12);
    const originalLanding = await landingPosition(point);
    const originalIronLanding = await landingPosition(ironPoint);
    const clubFilters = page.getByRole("group", { name: "Shot chart club filters" });
    await clubFilters.getByRole("radio", { name: /^Driver/ }).click();
    await expect(chart.locator("[data-today-shot-point]")).toHaveCount(9);
    await expectScale(chart, wide ? 100 : 50, true, carryCeiling);
    await expect(trajectory).toHaveAttribute("data-trajectory-max-carry", String(carryCeiling));
    expect(await landingPosition(point)).toEqual(originalLanding);
    await expect
      .poll(() =>
        chart.evaluate((svg) => {
          const labels = [...svg.querySelectorAll("text")];
          const target = labels
            .find((label) => label.textContent?.trim() === "Target ±10 yd")!
            .getBBox();
          const median = labels.find((label) => label.textContent?.trim() === "M")!.getBBox();
          return median.y - target.y - target.height;
        }),
      )
      .toBeGreaterThanOrEqual(0);

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
    await expectScale(chart, wide ? 100 : 50, true, carryCeiling);
    expect(await landingPosition(point)).toEqual(originalLanding);
    await page.getByRole("button", { name: "Show outliers", exact: true }).click();
    await expect(chart.locator('[data-today-shot-point="iron-9"]')).toHaveCount(1);
    expect(await landingPosition(point)).toEqual(originalLanding);
    await clubFilters.getByRole("radio", { name: /^7 iron/ }).click();
    await expectScale(chart, wide ? 100 : 50, true, carryCeiling);
    expect(await landingPosition(ironPoint)).toEqual(originalIronLanding);
    await expect(trajectory).toHaveAttribute("data-trajectory-max-carry", "150");
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
      const carryCeiling = wide ? 230 : 240;
      await renderFixture(page, `?surface=companion${wide ? "&wide=1&carry=224" : ""}`);
      const wrapper = page.locator("[data-mobile-dispersion-layout]");
      const chart = wrapper.locator("svg");
      const point = chart.getByRole("button", { name: "Driver shot 9", exact: true });
      await expectScale(wrapper, wide ? 100 : 50, false, carryCeiling);
      await expect(chart.getByRole("button", { name: "Driver shot 99", exact: true })).toHaveCount(
        0,
      );
      await expect(chart.getByRole("button")).toHaveCount(17);
      const originalLanding = await landingPosition(point);
      const originalAxisLabels = await chart.locator("text").allTextContents();
      await page
        .getByRole("radiogroup", { name: "Chart club" })
        .getByRole("radio", { name: "Driver", exact: true })
        .click();
      await expectScale(wrapper, wide ? 100 : 50, false, carryCeiling);
      expect(await landingPosition(point)).toEqual(originalLanding);
      await expect(chart.getByRole("button", { name: "Driver shot 99", exact: true })).toHaveCount(
        0,
      );
      await expect(chart.getByRole("button")).toHaveCount(9);
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
      await expectScale(wrapper, wide ? 100 : 50, false, carryCeiling);
      expect(await landingPosition(point)).toEqual(originalLanding);
      await expect(chart.getByRole("button", { name: "Driver shot 99", exact: true })).toHaveCount(
        0,
      );
      await expect(chart.getByRole("button")).toHaveCount(18);
      const box = (await chart.boundingBox())!;
      expect(box.height).toBeGreaterThan(box.width);
      await expectNoOverflow(page);
      await page.screenshot({
        path: info.outputPath(`companion-shot-charts-${width}-${wide ? "wide" : "standard"}.png`),
        fullPage: true,
        animations: "disabled",
      });
      await page
        .getByRole("radiogroup", { name: "Shot pattern view" })
        .getByRole("radio", { name: "Flight", exact: true })
        .click();
      const flight = page.locator("[data-mobile-flight-layout]");
      await expect(flight).toHaveAttribute("data-trajectory-max-carry", String(carryCeiling));
      await page
        .getByRole("radiogroup", { name: "Chart club" })
        .getByRole("radio", { name: "7 iron", exact: true })
        .click();
      await expect(flight).toHaveAttribute("data-trajectory-max-carry", "150");
      await page
        .getByRole("radiogroup", { name: "Flight detail" })
        .getByRole("radio", { name: "Club average", exact: true })
        .click();
      await expect(flight).toHaveAttribute("data-trajectory-max-carry", "150");
    }
  }
  expect(errors).toEqual([]);
});

test("Shared paired shot thumbnails retain matching landscape geometry by default", async ({
  page,
}, info) => {
  test.skip(!["chromium", "webkit"].includes(info.project.name));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await renderFixture(page, "?surface=thumbnails");

  const thumbnails = page.getByRole("region", { name: "Measured shot thumbnails" });
  const dispersion = thumbnails.getByRole("img", { name: "Dispersion chart", exact: true });
  const trajectory = thumbnails.getByRole("img", { name: "Trajectory chart", exact: true });
  await expect(dispersion).toHaveAttribute("viewBox", "0 0 820 430");
  await expect(trajectory).toHaveAttribute("viewBox", "0 0 820 430");
  await expectScale(dispersion, 50);
  await expect(trajectory).toHaveAttribute("data-trajectory-max-carry", "240");
  const dispersionBox = (await dispersion.boundingBox())!;
  const trajectoryBox = (await trajectory.boundingBox())!;
  expect(dispersionBox.width).toBeGreaterThan(dispersionBox.height * 1.8);
  expect(dispersionBox.width).toBeLessThan(320);
  expect(Math.abs(dispersionBox.height - trajectoryBox.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(dispersionBox.y - trajectoryBox.y)).toBeLessThanOrEqual(1);
  expect(trajectoryBox.x).toBeGreaterThan(dispersionBox.x + dispersionBox.width);
  await expectNoOverflow(page);
  await page.screenshot({
    path: info.outputPath("paired-shot-thumbnails.png"),
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
