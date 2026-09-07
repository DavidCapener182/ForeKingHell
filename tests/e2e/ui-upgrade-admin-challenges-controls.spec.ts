import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Template editor retains scoring draft and exact review payload on failure", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/admin-challenges.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/admin/admin-challenge-template-actions": path.resolve(
        "tests/fixtures/ui-upgrade/admin-challenge-template-actions.ts",
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
    await page.getByRole("button", { name: "Copy Synthetic drive", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Copy Synthetic drive", exact: true });
    const form = panel.getByRole("form", { name: "Template settings" });
    await form.getByRole("textbox", { name: /^Scoring rules \(JSON\)/ }).fill("invalid");
    await form.getByRole("button", { name: "Review template save", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("valid JSON");
    await form.getByRole("textbox", { name: /^Scoring rules \(JSON\)/ }).fill('{"minShots":7}');
    await form.getByRole("button", { name: "Review template save", exact: true }).click();
    await form.getByRole("button", { name: "Cancel review", exact: true }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { templateCalls?: unknown[] }).templateCalls ?? [],
      ),
    ).toEqual([]);
    await expect(form.getByRole("textbox", { name: /^Scoring rules \(JSON\)/ })).toHaveValue(
      '{"minShots":7}',
    );
    await form.getByRole("button", { name: "Review template save", exact: true }).click();
    await form.getByRole("button", { name: "Confirm template save", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Synthetic save unavailable");
    await form.getByRole("button", { name: "Confirm template save", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Template created.");
    const calls = await page.evaluate(
      () => (window as unknown as { templateCalls: Record<string, string>[] }).templateCalls,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[0].slug).toBe("synthetic-drive-copy");
    expect(calls[0].rulesJson).toBe('{"minShots":7}');
    expect(calls[0].id).toBeUndefined();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P80-controls-${width}.png`) });
  }
});
