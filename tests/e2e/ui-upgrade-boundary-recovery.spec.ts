import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { test, expect } from "@playwright/test";
import { injectAxe } from "./helpers";
test("shared error retry exposes a visible busy boundary and recovery", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/boundary-recovery.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
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
      body: '<!doctype html><html lang="en" data-theme="clubhouse" style="--font-ui-source:Arial;--font-body:Arial"><head><title>Shared fixture</title></head><body><div id="root"></div></body></html>',
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
    await page.addStyleTag({ content: css.css + bundle.outputFiles.filter(f=>f.path.endsWith(".css")).map(f=>f.text).join("\n") });
    await page.addScriptTag({ content: bundle.outputFiles.find(f=>f.path.endsWith(".js"))!.text });
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "This view could not be loaded" }),
    ).toBeVisible();
    const retry = page.getByRole("button", { name: "Retry", exact: true });
    await retry.focus();
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("link", { name: "Open saved golf" })).toHaveAttribute(
      "href",
      "/offline",
    );
    await page.screenshot({ path: info.outputPath(`error-${width}.png`), fullPage: true });
    await retry.press("Enter");
    await expect(page.getByRole("heading", { name: "Loading challenges" })).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Loading challenges" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.locator('[data-slot="skeleton"]')).not.toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`loading-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    if (width === 1440 || width === 360) {
      await injectAxe(page);
      const violations = await page.evaluate(async () => {
        const axe = (
          window as unknown as {
            axe: { run: () => Promise<{ violations: Array<{ id: string }> }> };
          }
        ).axe;
        return (await axe.run()).violations.map((v) => v.id);
      });
      expect(violations).toEqual([]);
    }
    await page.getByRole("button", { name: "Finish fixture recovery" }).click();
    await expect(page.getByRole("heading", { name: "Recovered challenge fixture" })).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
