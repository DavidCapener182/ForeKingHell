import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import ts from "typescript";
import tailwind from "@tailwindcss/postcss";
import { test, expect } from "@playwright/test";
import { bagMobileSectionsPlugin } from "../fixtures/ui-upgrade/bag-mobile-sections-build";

test("benchmark explanations and evidence stay inside their cells", async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e.stack);
  });
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/bag-mobile-populated.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [
      bagMobileSectionsPlugin(),
      {
        name: "read-only-boundaries",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/bag-mobile-navigation.ts"),
          }));
          builder.onResolve({ filter: /app\/bag\/lazy-bag-tools$/ }, () => ({
            path: "benchmark",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /^benchmark$/, namespace: "fixture" }, () => ({
            contents: [
              [
                "DistanceBenchmarkPanel",
                "LazyDistanceBenchmarkPanel",
                "src/app/bag/distance-benchmark-panel",
              ],
              [
                "ClubIntelligencePanel",
                "LazyClubIntelligencePanel",
                "src/app/bag/club-intelligence-panel",
              ],
              [
                "TargetDistanceSelector",
                "LazyTargetDistanceSelector",
                "src/app/bag/target-distance-selector",
              ],
              ["QuickBagClient", "LazyQuickBagClient", "src/app/quick-bag/quick-bag-client"],
            ]
              .map(
                ([name, alias, file]) =>
                  `export { ${name} as ${alias} } from "${path.resolve(file)}";`,
              )
              .join("\n"),
            loader: "tsx",
            resolveDir: process.cwd(),
          }));
          builder.onResolve({ filter: /app\/bag\/lazy-bag-simulator$/ }, () => ({
            path: "simulator",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /^simulator$/, namespace: "fixture" }, () => ({
            contents: `export { BagSimulator as LazyBagSimulator } from "${path.resolve("src/app/bag/bag-simulator")}";`,
            loader: "tsx",
            resolveDir: process.cwd(),
          }));
          // Only the separate server-loaded context panel is outside this browser boundary.
          builder.onResolve({ filter: /components\/analysis\/driver-development-panel$/ }, () => ({
            path: "driver",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /^driver$/, namespace: "fixture" }, () => ({
            contents: "export function DriverDevelopmentPanel(){ return null }",
            loader: "tsx",
          }));
          builder.onLoad(
            { filter: /(?:^|\/)(?:actions|[^/]*-actions)\.tsx?$/ },
            ({ path: file }) => {
              const source = readFileSync(file, "utf8");
              const ast = ts.createSourceFile(
                file,
                source,
                ts.ScriptTarget.Latest,
                true,
                ts.ScriptKind.TSX,
              );
              const names = ast.statements.flatMap((statement) =>
                ts.isFunctionDeclaration(statement) &&
                statement.name &&
                statement.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)
                  ? [statement.name.text]
                  : [],
              );
              return {
                contents: names
                  .map(
                    (name) =>
                      `export async function ${name}(){throw new Error("Read-only synthetic fixture: server action disabled")}`,
                  )
                  .join("\n"),
                loader: "tsx",
              };
            },
          );
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://bag-mobile.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Synthetic populated Bag regression</title></head><body style="margin:0"><div id="root"></div></body></html>',
    }),
  );
  for (const { width, theme } of [
    { width: 320, theme: "dark" },
    { width: 390, theme: "dark" },
    { width: 430, theme: "clubhouse" },
    { width: 390, theme: "range-night" },
    ...[768, 1280, 1795, 2048].map((width) => ({ width, theme: "clubhouse" })),
    { width: 2048, theme: "dark" },
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("https://bag-mobile.fixture/bag?tab=evidence&benchmark-edge-cases=1");
    await page.addStyleTag({ content: css.css });
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    await page.addStyleTag({ content: "body { font-family: system-ui, sans-serif; }" });
    for (const file of bundle.outputFiles.filter((f) => f.path.endsWith(".css")))
      await page.addStyleTag({ content: file.text });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith(".js"))!.text,
    });
    await expect(
      page.getByRole("heading", { name: "Distance benchmarks", exact: true }),
    ).toBeVisible();
    for (const metric of ["Best 30 avg", "Club speed", "Ball speed", "Smash", "Height", "Land"]) {
      const metricTab = page
        .locator("[data-benchmark-metric-tabs]")
        .getByRole("tab", { name: metric, exact: true });
      await metricTab.click();
      if (width < 640) {
        const carousel = page.locator("[data-mobile-benchmark-carousel]:visible").first();
        const visibleCard = carousel.locator('[data-slot="carousel-item"]').first();
        const clipped = await visibleCard
          .locator(".trust-indicator > span")
          .evaluateAll((spans) =>
            spans
              .filter(
                (span) =>
                  span.scrollWidth > span.clientWidth + 1 ||
                  getComputedStyle(span).whiteSpace === "nowrap",
              )
              .map((span) => span.textContent),
          );
        expect(
          clipped,
          `${theme} ${width} ${metric}: mobile labels and values must be readable`,
        ).toEqual([]);
        const contrastFailures = await page
          .locator(".trust-indicator:visible, .premium-rail-card:visible")
          .evaluateAll((surfaces) => {
            const rgb = (color: string) =>
              color
                .match(/[\d.]+/g)!
                .slice(0, 3)
                .map(Number);
            const luminance = (color: number[]) =>
              color
                .map((v) => {
                  const c = v / 255;
                  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
                })
                .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
            return surfaces.flatMap((surface) => {
              const style = getComputedStyle(surface);
              const fills = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((match) =>
                luminance(rgb(match[0])),
              );
              return [
                ...surface.querySelectorAll<HTMLElement>(
                  ".text-muted-foreground, .text-foreground, :scope > span",
                ),
              ]
                .filter((node) => node.textContent?.trim())
                .flatMap((node) => {
                  const foreground = luminance(rgb(getComputedStyle(node).color));
                  const ratios = fills.map(
                    (background) =>
                      (Math.max(foreground, background) + 0.05) /
                      (Math.min(foreground, background) + 0.05),
                  );
                  return ratios.some((ratio) => ratio < 4.5)
                    ? [node.textContent?.slice(0, 80)]
                    : [];
                });
            });
          });
        expect(
          contrastFailures,
          `${theme} ${metric}: mobile readout text must have readable contrast`,
        ).toEqual([]);
        if (metric === "Height")
          await page
            .locator(".premium-rail-card:visible")
            .last()
            .screenshot({ path: `output/bag-benchmark-text/${theme}-summary-${width}.png` });
        await visibleCard.screenshot({
          path: `output/bag-benchmark-text/${theme}-${metric}-${width}.png`,
        });
        await expect(
          page.locator("[data-mobile-benchmark-carousel]:visible").first(),
        ).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width + 1,
        );
        continue;
      }
      const table = page.locator('table[data-workbench-scope^="distance-benchmark-"]:visible');
      await expect(table).toHaveCount(1);
      const violations = await table
        .locator(
          'tbody td[data-column="next"], tbody td[data-column="metric-target"], tbody td[data-column="sample"], tbody td[data-column="tour-anchor"]',
        )
        .evaluateAll((cells) =>
          cells.flatMap((cell) => {
            const box = cell.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(cell);
            const out = [...range.getClientRects()].some(
              (rect) => rect.width > 0 && (rect.left < box.left - 1 || rect.right > box.right + 1),
            );
            return out || cell.scrollWidth > cell.clientWidth + 1
              ? [{ column: cell.getAttribute("data-column"), text: cell.textContent }]
              : [];
          }),
        );
      expect(violations, `${width} ${metric}: text must fit within its column`).toEqual([]);
      const scroll = table.locator("..");
      await scroll.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      const evidence = table.locator('tbody td[data-column="sample"]').first();
      const scrollBox = await scroll.boundingBox();
      const evidenceBox = await evidence.boundingBox();
      expect(evidenceBox!.x + evidenceBox!.width).toBeLessThanOrEqual(
        scrollBox!.x + scrollBox!.width + 1,
      );
      await scroll.evaluate((element) => {
        element.scrollLeft = 0;
      });
      const rows = await table
        .locator("tbody tr")
        .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
      expect(
        Math.max(...rows),
        `${width} ${metric}: closed evidence must stay compact`,
      ).toBeLessThan(180);
      const tickCollisions = await table
        .locator('[data-column="benchmark-band"], [data-column="metric-band"]')
        .evaluateAll((cells) =>
          cells.flatMap((cell) => {
            const ticks = [...cell.querySelectorAll("[data-benchmark-tick]")].map((tick) =>
              tick.getBoundingClientRect(),
            );
            return ticks.some((tick, i) => i > 0 && tick.left < ticks[i - 1].right - 1)
              ? [cell.textContent]
              : [];
          }),
        );
      expect(tickCollisions, `${width} ${metric}: scale labels must remain separate`).toEqual([]);
      const overflowingTicks = await table
        .locator("[data-benchmark-tick]")
        .evaluateAll((ticks) =>
          ticks
            .filter(
              (tick) => tick.getBoundingClientRect().height > tick.parentElement!.clientHeight + 1,
            )
            .map((tick) => tick.textContent),
        );
      expect(overflowingTicks, `${width} ${metric}: labels must fit within the legend`).toEqual([]);
      await table.screenshot({ path: `output/bag-benchmark-text/${theme}-${metric}-${width}.png` });
      if (metric === "Height" || metric === "Club speed") {
        const disclosure = table.locator("details[data-benchmark-evidence-details]").first();
        await disclosure.locator("summary").focus();
        await disclosure.locator("summary").press("Enter");
        await expect(disclosure.locator("p")).toContainText("excluded from this metric comparison");
        await expect(disclosure.locator("p")).toBeVisible();
        if (width === 2048 && theme === "clubhouse")
          await disclosure.screenshot({
            path: `output/bag-benchmark-text/${metric}-provenance-expanded.png`,
          });
        await disclosure.locator("summary").click();
        if (width === 2048 && theme === "clubhouse") {
          const pendingDownload = page.waitForEvent("download");
          await page.getByRole("button", { name: "Export", exact: true }).click();
          const download = await pendingDownload;
          const csv = readFileSync((await download.path())!, "utf8");
          expect(csv).toContain("excluded from this metric comparison.");
          expect(csv).not.toContain("excluded · details");
        }
      }
      if (metric === "Height") {
        await expect(
          table.locator('tbody td[data-column="current-value"]').filter({ hasText: /^0 yd$/ }),
        ).toHaveCount(1);
        await expect(
          table.locator('tbody td[data-column="current-value"]').filter({ hasText: /^--$/ }),
        ).toHaveCount(1);
      }
    }
  }
  expect(errors).toEqual([]);
});
