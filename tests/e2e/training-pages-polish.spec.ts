import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("synthetic training states preserve recovery, uncertainty and responsive access", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Four-width Chromium page review");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/training-pages.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://training-pages.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic training UI review</title></head><body style="font-family:system-ui,sans-serif"><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync("output/page-review-training", { recursive: true });
  for (const width of [390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ["locked", "recovery", "result", "loading"]) {
      await page.goto(`https://training-pages.fixture/preview?mode=${mode}`);
      await page.addStyleTag({ content: css.css });
      for (const file of bundle.outputFiles.filter((file) => file.path.endsWith(".css")))
        await page.addStyleTag({ content: file.text });
      await page.addScriptTag({
        content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
      });
      await expect(page.locator("[data-training-preview]")).toContainText(
        "SYNTHETIC TRAINING UI FIXTURE",
      );
      if (mode === "locked") {
        await expect(page.getByRole("link", { name: "Review Progress" })).toHaveAttribute(
          "href",
          "/progress",
        );
        await expect(page.getByRole("link", { name: "Build practice" })).toHaveAttribute(
          "href",
          "/practice",
        );
        await page.getByRole("link", { name: "View plans" }).focus();
        await page.keyboard.press("Tab");
        await expect(page.getByRole("link", { name: "Review Progress" })).toBeFocused();
      } else if (mode === "recovery") {
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(page.getByLabel("Fixture retry count")).toHaveText("1");
        await expect(page.getByRole("link", { name: "Open saved golf" })).toHaveAttribute(
          "href",
          "/offline",
        );
      } else if (mode === "result") {
        await expect(page.locator("[data-practice-result]")).toHaveAttribute(
          "data-practice-result",
          "awaiting_evidence",
        );
        await expect(page.locator("[data-practice-result]")).not.toContainText("20/100");
        await expect(page.locator("[data-practice-result]")).toContainText("Unallocated");
        await expect(page.locator("[data-practice-result]")).toContainText("Allocation unresolved");
        await expect(page.locator("ol")).toContainText(
          "Lateral reading unavailable · Inconclusive",
        );
        await expect(page.locator("ol")).toContainText("0.0 yd · Inside");
      } else {
        await expect(page.getByRole("status").first()).toContainText(
          "Loading your practice plan and upload review",
        );
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: `output/page-review-training/synthetic-${mode}-${width}.png`,
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
