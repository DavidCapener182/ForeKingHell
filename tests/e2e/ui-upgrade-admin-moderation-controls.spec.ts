import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Moderation clears hidden selection and reports partial confirmed counts exactly", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/moderation.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/admin/actions": path.resolve("tests/fixtures/ui-upgrade/moderation-actions.ts"),
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
    await page.getByRole("button", { name: "Select visible open records", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Review 2 selected reports", exact: true }),
    ).toBeEnabled();
    await page.getByRole("textbox", { name: "Search reports", exact: true }).fill("one");
    await expect(
      page.getByRole("button", { name: "Review 0 selected reports", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await page.getByRole("button", { name: "Select visible open records", exact: true }).click();
    await page.getByRole("button", { name: "Review 2 selected reports", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Resolve selected reports" });
    await expect(panel).toContainText("target-one");
    await expect(panel).toContainText("target-two");
    await panel.getByRole("button", { name: "Keep records open", exact: true }).click();
    await expect(panel).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { moderationCalls?: unknown[] }).moderationCalls ?? [],
      ),
    ).toEqual([]);
    await page.getByRole("button", { name: "Review 2 selected reports", exact: true }).click();
    await panel.getByRole("button", { name: "Confirm selected resolution", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("Synthetic resolution unavailable");
    await panel.getByRole("button", { name: "Confirm selected resolution", exact: true }).click();
    await expect(panel.getByRole("status")).toContainText("1 of 2 selected reports resolved.");
    expect(
      await page.evaluate(
        () => (window as unknown as { moderationCalls: unknown[] }).moderationCalls,
      ),
    ).toEqual([
      { operation: "bulk-resolve-reports", ids: ["one", "two"] },
      { operation: "bulk-resolve-reports", ids: ["one", "two"] },
    ]);
    await expect(
      panel.getByRole("button", { name: "Confirm selected resolution", exact: true }),
    ).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P78-controls-${width}.png`) });
  }
});
