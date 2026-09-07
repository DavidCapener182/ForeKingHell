import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Admin navigation and mobile queue details retain every operational destination", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/admin-overview.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/billing/actions": path.resolve("tests/fixtures/ui-upgrade/billing-actions.ts"),
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
    await page.getByRole("button", { name: "All admin sections", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "All admin sections" });
    await expect(menu.getByRole("link")).toHaveCount(6);
    await menu.getByRole("textbox", { name: "Search admin sections", exact: true }).fill("system");
    await expect(menu.getByRole("link")).toHaveCount(1);
    await expect(menu.getByRole("link", { name: "System checks", exact: true })).toHaveAttribute(
      "href",
      "/admin/system-checks",
    );
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    if (width < 768) {
      await page.getByRole("button", { name: /System verification.*Details/ }).click();
      const panel = page.getByRole("dialog", { name: "System verification" });
      await expect(panel).toContainText("No live CI, RLS or automated test result is connected.");
      await expect(panel.getByRole("link", { name: "View register", exact: true })).toHaveAttribute(
        "href",
        "/admin/system-checks",
      );
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Order: priority", exact: true }).click();
    await expect(page.getByRole("button", { name: "Order: area", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P76-controls-${width}.png`) });
  }
});
