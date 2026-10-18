import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("synthetic on-course recovery and empty workflows stay usable at all four widths", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix");
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/on-course-pages.tsx"],
    bundle: true,
    write: false,
    outdir: "output/on-course-fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [
      {
        name: "fixture-navigation",
        setup(builder) {
          builder.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/club-progress-navigation.ts"),
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://on-course-pages.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Synthetic on-course acceptance</title></head><body style="font-family:system-ui,sans-serif"><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync("output/page-review-on-course", { recursive: true });
  for (const width of [390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(
      "https://on-course-pages.fixture/review?q=unmatched&recordQuery=gross&recordLeader=invalid",
    );
    await page.addStyleTag({ content: css.css });
    for (const file of bundle.outputFiles.filter((file) => file.path.endsWith(".css")))
      await page.addStyleTag({ content: file.text });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    await page.waitForLoadState("networkidle");
    const nav = page.getByRole("group", { name: "Fixture section" });
    await page.getByLabel("Route area").selectOption("play");
    await page.getByRole("button", { name: "Retry play", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("Retry requests: 1");
    await expect(page.getByRole("link", { name: "Open saved golf" })).toHaveAttribute(
      "href",
      "/offline",
    );
    await page.screenshot({
      path: `output/page-review-on-course/synthetic-recovery-${width}.png`,
      fullPage: true,
    });
    await nav.getByRole("button", { name: "Round setup", exact: true }).click();
    await expect(page.getByRole("link", { name: "Add course", exact: true })).toHaveAttribute(
      "href",
      "/courses/new",
    );
    await expect(page.getByRole("button", { name: "Start round", exact: true })).toHaveCount(0);
    await nav.getByRole("button", { name: "Mobile history", exact: true }).click();
    await expect(page.getByText("No rounds match this view", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Show all saved rounds", exact: true }).click();
    await expect(
      page.getByRole("link", { name: /Synthetic Riverside Championship/ }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/q=unmatched/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/page-review-on-course/synthetic-round-history-${width}.png`,
      fullPage: true,
    });
    await nav.getByRole("button", { name: "Desktop history", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search rounds" }).fill("nothing-matches");
    await expect(page.getByText("No rounds match these filters", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Show all saved rounds", exact: true }).click();
    if (width >= 768)
      await expect(
        page.getByRole("region", { name: "Round scoring history table" }),
      ).toHaveAttribute("tabindex", "0");
    await nav.getByRole("button", { name: "Record search", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("1 of 1 loaded courses");
    await expect(page.getByText("No boards match these filters", { exact: true })).toHaveCount(0);
    await page
      .getByRole("searchbox", { name: "Search course, golfer or category" })
      .fill("nothing-matches");
    await expect(page.getByText("No boards match these filters", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("1 of 1 loaded courses");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/page-review-on-course/synthetic-record-search-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
