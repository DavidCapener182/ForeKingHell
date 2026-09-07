import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Shared twin exposes readable scope and canonical read-only fallback", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/shared-twin.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    plugins: [
      {
        name: "stub-three-scene",
        setup(build) {
          build.onResolve({ filter: /^\.\/course-twin-scene$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/twin-scene-stub.tsx"),
          }));
        },
      },
    ],
    alias: {
      "next/navigation": path.resolve("tests/fixtures/ui-upgrade/twin-navigation.ts"),
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
    await page.goto("https://twin.fixture/?quality=2d&hole=2");
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
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Synthetic shared replay with a long course name",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(/Only the linked reconstructed shot path/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Product home", exact: true })).toBeVisible();
    if (width >= 1024) {
      const plan = page.locator("[data-course-twin-low-power-fallback]");
      await expect(plan.getByRole("button", { name: "Hole 2", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await plan.getByRole("button", { name: "Hole 1", exact: true }).click();
      await expect(plan.getByRole("button", { name: "Hole 1", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    } else {
      const plan = page.locator("[data-course-twin-mobile-overhead]");
      await expect(plan.getByRole("heading", { name: "Hole 2", exact: true })).toBeVisible();
      await plan.getByRole("button", { name: "Previous", exact: true }).click();
      await expect(plan.getByRole("heading", { name: "Hole 1", exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("button", { name: /Save plan|Create room|Start round/i }),
    ).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P89-fallback-${width}.png`) });
  }
  expect(errors).toEqual([]);
});
