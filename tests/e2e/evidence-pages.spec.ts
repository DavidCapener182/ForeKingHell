import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("synthetic evidence pages: recovery, upload controls and explicit confirmation at four widths", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Four-width Chromium fixture matrix");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/evidence-pages.tsx"],
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
  await page.route("https://evidence-pages.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Synthetic evidence page review</title></head><body style="font-family:system-ui,sans-serif"><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync("output/page-review-evidence", { recursive: true });
  for (const width of [390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("https://evidence-pages.fixture/review");
    await page.addStyleTag({ content: css.css });
    for (const file of bundle.outputFiles.filter((file) => file.path.endsWith(".css")))
      await page.addStyleTag({ content: file.text });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    await expect(page.getByRole("button", { name: "Retry import workspace" })).toBeFocused();
    await expect(page.getByRole("link", { name: "Check saved sessions" })).toHaveAttribute(
      "href",
      "/sessions",
    );
    await page.screenshot({
      path: `output/page-review-evidence/synthetic-recovery-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Recovery confirmed in fixture" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "upload", exact: true }).click();
    await page.getByRole("button", { name: "Toggle simulated reading" }).click();
    await expect(
      page.getByRole("button", {
        name: "Remove Synthetic_very_long_source_session_name_for_wrap_and_mobile_check.csv",
      }),
    ).toBeDisabled();
    await expect(page.getByRole("button", { name: "Retry file" })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("40%");
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("main *")]
        .filter((node) => node.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 12)
        .map((node) => ({
          tag: node.tagName,
          className: node.className,
          width: node.getBoundingClientRect().width,
        })),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      JSON.stringify(overflow),
    ).toBe(true);
    await page.screenshot({
      path: `output/page-review-evidence/synthetic-upload-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Toggle simulated reading" }).click();
    await page.getByRole("button", { name: "Retry file" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "confirmation", exact: true }).click();
    await expect(page.getByRole("button", { name: "Continue fixture review" })).toBeDisabled();
    await page.getByRole("button", { name: "Confirm 7 Iron for shot 2" }).focus();
    await page.screenshot({
      path: `output/page-review-evidence/synthetic-confirmation-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("Club confirmed");
    await expect(page.getByRole("button", { name: "Continue fixture review" })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});
