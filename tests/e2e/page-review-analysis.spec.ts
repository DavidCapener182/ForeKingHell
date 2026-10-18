import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("synthetic analysis components preserve target validation, empty actions and qualitative training context at four widths", async ({
  page,
}) => {
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/analysis-pages.tsx"],
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
  await page.route("https://analysis-pages.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Synthetic analysis page review</title></head><body style="font-family:system-ui,sans-serif"><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync("output/page-review-analysis", { recursive: true });
  for (const width of [390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("https://analysis-pages.fixture/quick-bag");
    await page.addStyleTag({ content: css.css });
    for (const file of bundle.outputFiles.filter((file) => file.path.endsWith(".css")))
      await page.addStyleTag({ content: file.text });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    await expect(
      page.getByRole("heading", { name: "On-course evidence and training context" }),
    ).toBeVisible();
    const target = page.getByRole("spinbutton", { name: "Target distance", exact: true });
    await target.fill("151");
    await expect(target).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("[data-quick-bag-best-match]")).toContainText("7 iron");
    await expect(page.getByText("Build a baseline", { exact: true }).first()).toBeVisible();
    await expect(page.locator("main")).not.toContainText("/100");
    await page.getByRole("button", { name: "Use metres", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Use yards", exact: true })).toBeVisible();
    await expect(page.locator("[data-quick-bag-best-match]")).toContainText("7 m left");
    await target.fill("1");
    await expect(target).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#quick-bag-target-error")).toBeVisible();
    await expect(target).toHaveAttribute("aria-describedby", /quick-bag-target-error/);
    await target.fill("138.0744");
    await expect(target).toHaveAttribute("aria-invalid", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/page-review-analysis/synthetic-measured-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Show empty bag", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Build your on-course reference" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Bag", exact: true })).toHaveAttribute(
      "href",
      "/bag",
    );
    await expect(page.getByRole("link", { name: "Import a session", exact: true })).toHaveAttribute(
      "href",
      "/import",
    );
    await expect(target).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/page-review-analysis/synthetic-empty-${width}.png`,
      fullPage: true,
    });
    await page.goto("https://analysis-pages.fixture/workspace?recovery=1");
    await page.addStyleTag({ content: css.css });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByLabel("Recovery retry count")).toHaveText("1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/page-review-analysis/synthetic-recovery-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
