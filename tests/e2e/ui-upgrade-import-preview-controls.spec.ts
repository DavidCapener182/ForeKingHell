import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { test, expect } from "@playwright/test";
test("Import saved views keep transient corrections and export every filtered row", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/import-preview-controls.tsx"],
    outdir: "output/fixture",
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://import.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse" style="--font-ui-source:Arial;--font-body:Arial"><head><title>Import fixture</title></head><body><div id="root"></div></body></html>',
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
    await page.goto("https://import.fixture");
    await page.evaluate(() => localStorage.clear());
    await page.addStyleTag({
      content:
        css.css +
        bundle.outputFiles
          .filter((f) => f.path.endsWith(".css"))
          .map((f) => f.text)
          .join("\n"),
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((f) => f.path.endsWith(".js"))!.text,
    });
    const preview = page.locator("[data-import-shot-preview]");
    if (width < 1024)
      await preview.getByRole("button", { name: /7 iron · Shot 1 Review details Alpha/ }).click();
    else await preview.getByRole("button", { name: "Details", exact: true }).first().click();
    await page.getByRole("button", { name: /Confirm club/ }).click();
    await page.getByRole("option", { name: "Driver", exact: true }).click();
    await page.getByRole("button", { name: "Back to preview" }).click();
    const search = page.getByRole("searchbox", { name: "Find a shot" });
    await search.fill("Alpha");
    await preview.getByRole("button", { name: /^Columns/ }).click();
    await page.getByRole("menuitemcheckbox", { name: "Total (yd)", exact: true }).click();
    await page.keyboard.press("Escape");
    await preview.getByRole("button", { name: "Saved views", exact: true }).click();
    await page.getByRole("menuitem", { name: "Save current view", exact: true }).click();
    await page.getByRole("textbox", { name: "View name" }).fill("Alpha layout");
    await page.getByRole("button", { name: "Save view", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await search.fill("Beta");
    await preview.getByRole("button", { name: "Saved views", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Alpha layout/ }).click();
    await expect(search).toHaveValue("Alpha");
    await expect(page).toHaveURL("https://import.fixture/");
    await expect(preview.locator('[data-column="total"]').first()).toBeHidden();
    await expect(preview.getByRole("button", { name: "Copy link", exact: true })).toHaveCount(0);
    await preview.getByRole("button", { name: "Next", exact: true }).click();
    await expect(preview.getByRole("status").filter({ hasText: "Page 2 of 2" })).toBeVisible();
    const pending = page.waitForEvent("download");
    await preview.getByRole("button", { name: "Export 25 filtered shots", exact: true }).click();
    const download = await pending;
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv.split("\r\n")).toHaveLength(26);
    expect(csv).toContain("driver");
    expect(csv).not.toContain("Beta.csv");
    expect(csv).toContain("Total (yd)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`import-controls-${width}.png`),
      animations: "disabled",
    });
  }
  expect(errors).toEqual([]);
});
