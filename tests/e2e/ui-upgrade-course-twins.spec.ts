import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Course Twin catalogue preserves quality and exact fallback targets", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/course-twins.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "next/navigation": path.resolve("tests/fixtures/ui-upgrade/rapsodo-navigation.tsx"),
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
  await page.route("https://twin.fixture/broken.png", (route) =>
    route.fulfill({ status: 404, body: "Missing fixture image" }),
  );
  await page.route("https://twin.fixture/valid.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="140"><rect width="320" height="140" fill="#244f38"/><text x="20" y="70" fill="white">Synthetic mapped preview</text></svg>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.log("FIXTURE PAGE ERROR", error.message);
  });
  for (const surface of ["workbench", "companion"])
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
      await page.evaluate(
        (value) => (document.documentElement.dataset.appSurface = value),
        surface,
      );
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
      const card = page.locator('[data-course-twin="fixture-course-b"]');
      await expect(card.getByText("Preview could not load", { exact: true })).toBeVisible();
      await expect(
        card.getByText(/local hazards and green conditions must be checked before play/),
      ).toBeVisible();
      await expect(
        card.getByRole("link", { name: "Open Course Twin", exact: true }),
      ).toHaveAttribute("href", "/play/fixture-course-b");
      await card.locator("summary").click();
      await expect(card.getByRole("link", { name: "View mapped holes" })).toHaveAttribute(
        "href",
        "/courses/fixture-course-b/holes",
      );
      await page.getByRole("textbox", { name: "Search Course Twins" }).fill("no-match-query");
      await expect(page.getByText("No Course Twins match", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Clear filters", exact: true }).click();
      await page.getByRole("radio", { name: "Grade C", exact: true }).click();
      await expect(page.locator("[data-course-twin]")).toHaveCount(1);
      await expect(page.getByText("Not recorded", { exact: true })).toHaveCount(2);
      await page.getByRole("radio", { name: "All grades", exact: true }).click();
      await expect(page.locator("[data-course-twin]")).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`P52-${surface}-${width}.png`),
        animations: "disabled",
        fullPage: true,
      });
    }
  expect(errors).toEqual([]);
});
