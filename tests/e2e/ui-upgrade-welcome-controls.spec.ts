import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Welcome uses saved step state and keeps skip errors recoverable", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/welcome.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/welcome/actions": path.resolve("tests/fixtures/ui-upgrade/welcome-actions.ts"),
      "next/navigation": path.resolve("tests/fixtures/ui-upgrade/achievement-navigation.ts"),
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
    await page.addStyleTag({
      content:
        css.css +
        bundle.outputFiles
          .filter((file) => file.path.endsWith(".css"))
          .map((file) => file.text)
          .join("\n"),
    });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    await expect(
      page.getByRole("heading", {
        level: 1,
        exact: true,
        name: "Import your first measured session",
      }),
    ).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
    await expect(page.locator('[aria-current="step"]')).toContainText(
      "Import your first measured session",
    );
    await expect(
      page.getByRole("link", { name: "Continue: Import your first measured session", exact: true }),
    ).toHaveAttribute("href", "/import");
    await page.getByRole("button", { name: "Skip setup for now", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Synthetic save unavailable");
    await expect(
      page.getByRole("button", { name: "Skip setup for now", exact: true }),
    ).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P85-controls-${width}.png`) });
  }
  await page.goto("https://twin.fixture/?unavailable=1");
  await page.addStyleTag({
    content:
      css.css +
      bundle.outputFiles
        .filter((file) => file.path.endsWith(".css"))
        .map((file) => file.text)
        .join("\n"),
  });
  await page.addScriptTag({
    content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Setup progress is unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("No completed steps are inferred");
});
