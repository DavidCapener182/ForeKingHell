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
  for (const width of [390, 768, 1280, 1795, 2048]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("https://bag-mobile.fixture/bag?tab=evidence");
    await page.addStyleTag({ content: css.css });
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
        if (metric === "Best 30 avg")
          await page.screenshot({
            path: `output/bag-benchmark-text/mobile-${width}.png`,
            fullPage: true,
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
      if (metric === "Best 30 avg")
        await table.screenshot({ path: `output/bag-benchmark-text/carry-${width}.png` });
    }
  }
  expect(errors).toEqual([]);
});
