import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Achievements preserve large totals full evidence filters calendar and share review", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/achievements.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/achievements/actions": path.resolve(
        "tests/fixtures/ui-upgrade/achievement-actions.ts",
      ),
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

  let downloads = 0;
  await page.route("https://twin.fixture/api/share-cards/feed/synthetic-feed", (route) => {
    downloads++;
    return route.fulfill({
      status: downloads === 1 ? 503 : 200,
      contentType: downloads === 1 ? "application/json" : "image/svg+xml",
      body:
        downloads === 1 ? "{}" : '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"])
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      downloads = 0;
      await page.setViewportSize({ width, height });
      await page.goto("https://twin.fixture/");
      await page.evaluate(
        (value) => (document.documentElement.dataset.appSurface = value),
        surface,
      );
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
      await expect(page.getByText("1,200 / 1,201", { exact: true })).toBeVisible();
      const count = page.getByText("1,200 / 1,201", { exact: true });
      expect(await count.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      const search = page.getByRole("textbox", { name: "Search achievements", exact: true });
      await search.fill("nonexistent-target");
      await expect(page.getByText("60,000", { exact: true }).first()).toBeVisible();
      await expect(page.locator("[data-achievement-catalogue-item]")).toHaveCount(0);
      await page.getByRole("button", { name: "Clear all filters", exact: true }).click();
      await page.getByRole("button", { name: /^Unlocked/ }).click();
      await search.fill("Synthetic badge 1199");
      const badge = page.locator("[data-achievement-catalogue-item]");
      await expect(badge).toHaveCount(1);
      await badge.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByText("Synthetic source evidence, manual fixture", { exact: true }),
      ).toBeVisible();
      await expect(dialog.getByRole("link", { name: "Open source", exact: true })).toHaveAttribute(
        "href",
        "/sessions/synthetic-source",
      );
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /XP unlock ledger/ }).click();
      if (width < 768) {
        await page
          .getByRole("button", { name: "View details for Synthetic badge 0", exact: true })
          .click();
        await expect(
          dialog.getByText("Synthetic source evidence, manual fixture", { exact: true }),
        ).toBeVisible();
        await dialog.getByRole("button", { name: "Close details", exact: true }).click();
        await page
          .getByRole("textbox", { name: "Select unlock date", exact: true })
          .fill("2026-09-05");
      } else {
        await page
          .locator("[data-achievement-calendar-day]")
          .filter({ hasText: /^5$/ })
          .first()
          .click();
      }
      await expect(page.locator("[data-achievement-calendar-detail]")).toContainText(
        "No achievements",
      );
      await page.getByRole("button", { name: "Preview achievement card", exact: true }).click();
      await expect(
        dialog.getByText("Source feed audience: private", { exact: false }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      expect(downloads).toBe(0);
      await page.getByRole("button", { name: "Preview achievement card", exact: true }).click();
      await dialog.getByRole("button", { name: "Download this card", exact: true }).click();
      await expect(dialog.getByRole("alert")).toBeVisible();
      await dialog.getByRole("button", { name: "Download this card", exact: true }).click();
      await expect(dialog.getByRole("status")).toContainText("Nothing has been posted");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      expect(downloads).toBe(2);
      await expect(count).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: info.outputPath(`P63-${surface}-${width}.png`),
        animations: "disabled",
      });
    }
  expect(errors).toEqual([]);
});
