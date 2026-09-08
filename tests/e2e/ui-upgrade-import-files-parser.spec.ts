import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Mixed parser failure preserves good previews and removal restores save", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/import-files.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/lib/imports/normalized-import": path.resolve(
        "tests/fixtures/ui-upgrade/import-files-parser.ts",
      ),
    },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://twin.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Course Twin fixture</title></head><body><div id="root"></div></body></html>',
    }),
  );

  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("https://twin.fixture/");
    await page.addStyleTag({ content: css.css });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    const csv =
      "Shot Number,Club,Carry Distance,Total Distance,Ball Speed,Launch Angle,Side Carry\n1,7 Iron,150,160,110,18,1\n2,7 Iron,152,162,111,19,2";
    await page.getByLabel("Choose CSV files").setInputFiles([
      { name: "good.csv", mimeType: "text/csv", buffer: Buffer.from(csv) },
      { name: "broken.csv", mimeType: "text/csv", buffer: Buffer.from(csv) },
    ]);
    await expect(page.getByRole("status")).toHaveText("1 valid previews");
    await expect(page.getByText("good.csv · 2 shots", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("broken.csv: Synthetic parser failure");
    await expect(page.getByRole("button", { name: "Save preview" })).toBeDisabled();
    await page.getByRole("button", { name: "Remove broken.csv" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save preview" })).toBeEnabled();
    await expect(page.getByText("good.csv · 2 shots", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    if (width === 390)
      await page.screenshot({ path: info.outputPath(`mixed-parser-${width}.png`) });
  }
});
