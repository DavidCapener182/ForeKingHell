import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import ts from "typescript";
import tailwind from "@tailwindcss/postcss";
import { test, expect } from "@playwright/test";
import { bagMobileSectionsPlugin } from "../fixtures/ui-upgrade/bag-mobile-sections-build";

test("populated Bag keeps phone content reachable without clipping on both app surfaces", async ({
  page,
}) => {
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
  mkdirSync("output/bag-mobile-overflow", { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const assertReachable = async (label: string) => {
    const violations = await page.locator("main").evaluate((main) => {
      const windowLeft = Math.max(0, main.getBoundingClientRect().left);
      const windowRight = Math.min(innerWidth, main.getBoundingClientRect().right);
      return [
        ...main.querySelectorAll<HTMLElement>(
          "section,article,[data-slot=card],[data-slot=card-content],button,input,select,h1,h2,h3,p,a,[data-slot=table-container]",
        ),
      ].flatMap((element) => {
        if (!element.checkVisibility() || element.closest("[hidden],[inert],.sr-only")) return [];
        // Transformed carousel slides are verified one by one with their real controls below.
        if (element.closest('[data-slot="carousel-item"]')) return [];
        const bounds = element.getBoundingClientRect();
        if (bounds.width < 2 || bounds.height < 2) return [];
        // Wide tables and tab strips are intentional contained scroll regions.
        // Their own boxes must fit; only their scrollable descendants may extend.
        let parent = element.parentElement;
        while (parent && parent !== main) {
          const style = getComputedStyle(parent);
          if (
            ["auto", "scroll"].includes(style.overflowX) &&
            parent.scrollWidth > parent.clientWidth + 1
          )
            return [];
          parent = parent.parentElement;
        }
        return bounds.left < windowLeft - 1 ||
          bounds.right > windowRight + 1 ||
          (element.tagName === "BUTTON" && element.scrollWidth > element.clientWidth + 1)
          ? [
              {
                tag: element.tagName,
                classes: element.className,
                text: element.textContent?.slice(0, 90),
                left: bounds.left,
                right: bounds.right,
                windowLeft,
                windowRight,
              },
            ]
          : [];
      });
    });
    expect(
      violations,
      label + ": visible content must fit instead of being clipped by ancestors",
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      (await page.viewportSize())!.width + 1,
    );
  };
  // A second phone font exercises different platform glyph/min-content widths.
  for (const { width, font } of [
    { width: 320, font: "Arial, sans-serif" },
    ...[320, 375, 390, 430, 768, 1024, 1280, 1440].map((width) => ({ width, font: "system-ui" })),
  ])
    for (const surface of ["workbench", "companion"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`https://bag-mobile.fixture/bag?surface=${surface}`);
      await page.addStyleTag({ content: css.css });
      await page.addStyleTag({ content: `body { font-family: ${font}; }` });
      expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
        font === "system-ui" ? "system-ui" : "Arial",
      );
      for (const file of bundle.outputFiles.filter((f) => f.path.endsWith(".css")))
        await page.addStyleTag({ content: file.text });
      await page.addScriptTag({
        content: bundle.outputFiles.find((f) => f.path.endsWith(".js"))!.text,
      });
      const tabs = page.getByRole("tablist", { name: "Bag workspace" });
      await expect(tabs.getByRole("tab", { name: "Distances", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.screenshot({
        path: `output/bag-mobile-overflow/${process.env.FKH_BAG_BASELINE === "1" ? "released-baseline" : "fixed"}-${surface}-${width}-initial.png`,
        fullPage: true,
      });
      for (const tab of ["Distances", "Clubs", "Scoring", "Fitting", "History", "Evidence"]) {
        await tabs.getByRole("tab", { name: tab, exact: true }).click();
        await assertReachable(`${surface} ${width} ${tab}`);
        if (width <= 430 && (tab === "Distances" || tab === "Clubs")) {
          if (tab === "Distances")
            await page.getByRole("button", { name: /Explore your distances/ }).click();
          else await page.locator("[data-selected-club-detail-trigger]:visible").click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          if (tab === "Distances") {
            const select = dialog.getByRole("combobox");
            // LW is intentionally touch evidence, excluded from the full-shot distance view.
            await expect(select.locator("option")).toHaveCount(12);
            await expect(select.locator('option[value="fixture-lw"]')).toHaveCount(0);
            await select.selectOption("fixture-sw");
            await expect(select).toHaveValue("fixture-sw");
          }
          const overflow = await dialog.evaluate((root) => {
            const frame = root.getBoundingClientRect();
            return [...root.querySelectorAll<HTMLElement>("p,h2,h3,button,select")].flatMap(
              (element) => {
                if (!element.checkVisibility() || element.closest(".sr-only,[hidden],[inert]"))
                  return [];
                const box = element.getBoundingClientRect();
                return box.left < frame.left - 1 ||
                  box.right > frame.right + 1 ||
                  (element.tagName !== "SELECT" && element.scrollWidth > element.clientWidth + 1)
                  ? [
                      {
                        text: element.textContent?.slice(0, 90),
                        left: box.left,
                        right: box.right,
                        box: element.clientWidth,
                        content: element.scrollWidth,
                      },
                    ]
                  : [];
              },
            );
          });
          expect(
            overflow,
            `${surface} ${width} ${tab}: drawer content must remain reachable`,
          ).toEqual([]);
          const box = await dialog.boundingBox();
          expect(box!.x).toBeGreaterThanOrEqual(-1);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
          await dialog
            .getByRole("button", {
              name: tab === "Distances" ? "Done" : "Close details",
              exact: true,
            })
            .click();
          await expect(dialog).not.toBeVisible();
        }
        for (const trigger of await page
          .locator("[data-bag-supporting-evidence] button[aria-expanded=false]:visible")
          .all())
          await trigger.click();
        await assertReachable(`${surface} ${width} ${tab} expanded`);
        const failures = await page
          .locator("[data-bag-distance-ladder] a:visible")
          .evaluateAll((elements) =>
            elements.flatMap((element) => {
              const e = element as HTMLElement;
              return e.scrollWidth > e.clientWidth + 1
                ? [
                    {
                      width: e.clientWidth,
                      content: e.scrollWidth,
                      text: e.textContent?.slice(0, 100),
                    },
                  ]
                : [];
            }),
          );
        expect(failures, `${surface} ${width}: ladder content must fit`).toEqual([]);
        // Every wide table remains scrollable to its final column, within its own box.
        for (const table of await page.locator("main [data-slot=table-container]:visible").all()) {
          await table.focus();
          await table.evaluate((element) => {
            element.scrollLeft = element.scrollWidth;
          });
          expect(
            await table.evaluate(
              (element) => element.scrollWidth - element.clientWidth - element.scrollLeft,
            ),
          ).toBeLessThanOrEqual(1);
          await table.evaluate((element) => {
            element.scrollLeft = 0;
          });
        }
        for (const carousel of await page.locator('main [data-slot="carousel"]:visible').all()) {
          const viewport = carousel.locator('[data-slot="carousel-content"]');
          const slides = carousel.locator('[data-slot="carousel-item"]');
          const next = carousel.getByRole("button", { name: "Next slide", exact: true });
          for (let index = 0; index < (await slides.count()); index++) {
            const slide = slides.nth(index);
            await expect
              .poll(
                async () => {
                  const frame = await viewport.boundingBox();
                  const card = await slide.locator(":scope > *").first().boundingBox();
                  return (
                    !!frame &&
                    !!card &&
                    card.x >= frame.x - 1 &&
                    card.x + card.width <= frame.x + frame.width + 1
                  );
                },
                { message: `${surface} ${width}: carousel card ${index + 1} is reachable` },
              )
              .toBe(true);
            const clipped = await slide.locator("p,button,a").evaluateAll((elements) =>
              elements.flatMap((element) => {
                const e = element as HTMLElement;
                return e.scrollWidth > e.clientWidth + 1
                  ? [
                      {
                        text: e.textContent?.slice(0, 90),
                        box: e.clientWidth,
                        content: e.scrollWidth,
                      },
                    ]
                  : [];
              }),
            );
            expect(
              clipped,
              `${surface} ${width}: selected carousel card content cannot be clipped`,
            ).toEqual([]);
            if (index + 1 < (await slides.count())) {
              await expect(next).toBeEnabled();
              await next.click();
            }
          }
        }
        await page.screenshot({
          path: `output/bag-mobile-overflow/${surface}-${width}-${tab.toLowerCase()}.png`,
          fullPage: true,
        });
      }
      // Keyboard navigation can reveal the last tab instead of leaving it clipped.
      await tabs.getByRole("tab", { name: "Distances", exact: true }).focus();
      await page.keyboard.press("End");
      await expect(tabs.getByRole("tab", { name: "Evidence", exact: true })).toBeFocused();
      const last = await tabs.getByRole("tab", { name: "Evidence", exact: true }).boundingBox();
      expect(last!.x + last!.width).toBeLessThanOrEqual(width + 1);
      expect(errors).toEqual([]);
    }
});
