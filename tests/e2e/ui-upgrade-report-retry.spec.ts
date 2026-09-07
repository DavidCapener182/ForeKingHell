import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("Report retry retains the attempt after response loss, and changes identity for a new draft", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/report-retry.tsx"],
    bundle: true,
    write: false,
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "report-fixture",
        setup(build) {
          build.onResolve({ filter: /^\.\/actions$/ }, (args) =>
            args.importer.endsWith("report-builder.tsx")
              ? { path: path.resolve("tests/fixtures/ui-upgrade/report-retry-actions.ts") }
              : undefined,
          );
        },
      },
    ],
    alias: {
      "next/navigation": path.resolve("tests/fixtures/ui-upgrade/report-retry-navigation.ts"),
    },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://reports.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Report retry</title></head><body><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [390, 844],
    [360, 800],
    [1023, 800],
    [1024, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("https://reports.fixture");
    await page.addStyleTag({ content: css.css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const title = page.getByRole("textbox", { name: "Report title (optional)" });
    await title.fill("Synthetic frozen draft");
    await page.getByRole("button", { name: "Continue to privacy" }).click();
    await page.getByRole("button", { name: "Review report", exact: true }).click();
    const review = page.getByRole("dialog", { name: "Review frozen report" });
    const create = review.getByRole("button", { name: "Create frozen report link" });
    await create.click();
    await expect(review.getByRole("alert")).toContainText(
      "retrying this draft will not create a duplicate",
    );
    await create.click();
    await expect(review).toBeHidden();
    await expect(page).toHaveURL(/recovered=1/);
    const attempts = await page.evaluate(
      () => (window as unknown as { reportAttempts: string[] }).reportAttempts,
    );
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(attempts[1]).toBe(attempts[0]);
    await page.getByRole("button", { name: "Back to evidence" }).click();
    await expect(title).toHaveValue("Synthetic frozen draft");
    await title.fill("Another explicitly edited report");
    await page.getByRole("button", { name: "Continue to privacy" }).click();
    await page.getByRole("button", { name: "Review report", exact: true }).click();
    await create.click();
    await expect(review).toBeHidden();
    const finalAttempts = await page.evaluate(
      () => (window as unknown as { reportAttempts: string[] }).reportAttempts,
    );
    expect(finalAttempts[2]).not.toBe(attempts[0]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`report-retry-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});
