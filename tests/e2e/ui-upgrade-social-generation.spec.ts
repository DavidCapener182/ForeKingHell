import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Recap generation retains reviewed source parameters on failure and retry", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/social-generation.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/social-intelligence/actions": path.resolve(
        "tests/fixtures/ui-upgrade/social-generation-actions.ts",
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
    await page.getByRole("button", { name: "Generate recap", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Recap type", exact: true })
      .selectOption("tournament_recap");
    await dialog
      .getByRole("combobox", { name: "Saved visibility", exact: true })
      .selectOption("private");
    await dialog.getByRole("button", { name: "Review request", exact: true }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { generationCalls?: unknown[] }).generationCalls ?? [],
      ),
    ).toEqual([]);
    await dialog.getByRole("button", { name: "Confirm generation", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Synthetic generation unavailable");
    await expect(dialog).toContainText("Tournament recap guidance");
    await expect(dialog).toContainText("your 8 latest feed activities");
    await dialog.getByRole("button", { name: "Confirm generation", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("Recap saved");
    const calls = await page.evaluate(
      () => (window as unknown as { generationCalls: Record<string, string>[] }).generationCalls,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[1]).toMatchObject({
      operation: "generate",
      summaryType: "tournament_recap",
      visibility: "private",
    });
  }
});
