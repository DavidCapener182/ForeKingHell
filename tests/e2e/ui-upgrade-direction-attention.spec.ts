import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { test, expect } from "@playwright/test";
test("direction attention retains scope, counts and exact repair destinations", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/direction-attention.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://shared.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Shared fixture</title></head><body><div id="root"></div></body></html>',
    }),
  );

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("https://shared.fixture");
    await page.addStyleTag({ content: css.css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await expect(
      page.getByText("Showing the newest 100 of 103 sessions. Search covers this loaded list."),
    ).toBeVisible();
    await page.getByLabel("Search direction reviews").fill("unusually long");
    await expect(page.getByRole("status")).toHaveText("1 matching sessions");
    const link = page.getByRole("link", { name: /Review session:/ });
    await expect(link).toHaveAttribute("href", "/sessions/direction-0");
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByText("Session alignment needs review.", { exact: false })).toContainText(
      "2 shots have a questionable-direction flag.",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`direction-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByLabel("Search direction reviews").fill("no match");
    await expect(
      page.getByText("No direction reviews match this search.", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show resolved state" }).click();
    await expect(
      page.getByText("No saved alignment or questionable-direction flags need review."),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
