import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("P33 goal forms preserve failed drafts, request IDs and confirmation", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/goals.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "goal-fixtures",
        setup(build) {
          build.onResolve({ filter: /^@\/app\/goals\/actions$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/goal-actions.ts"),
          }));
          build.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/goal-navigation.ts"),
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://goals.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Goals fixture</title></head><body><div id="root"></div></body></html>',
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
    await page.goto("https://goals.fixture/");
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
    await page.getByRole("button", { name: "Add goal", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add a measured goal", exact: true });
    await expect(dialog).toBeVisible();
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
    await dialog
      .getByLabel("Goal title", { exact: true })
      .fill("Driver carry with a long retained title");
    await dialog.getByLabel("Club or context").fill("Driver");
    await dialog.getByLabel("Starting value").fill("190");
    await dialog.getByLabel("Current value").fill("195");
    await dialog.getByLabel("Target value").fill("230");
    await dialog.getByLabel("Recommended next action").fill("Record twelve measured shots");
    await expect(dialog.getByLabel("Evidence source")).toHaveValue("Manually saved goal value");
    await dialog.getByRole("button", { name: "Add goal", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toContainText("draft is retained");
    await expect(dialog.getByLabel("Goal title", { exact: true })).toHaveValue(
      "Driver carry with a long retained title",
    );
    await page.screenshot({ path: info.outputPath(`P33-${width}-retained.png`) });
    await dialog.getByRole("button", { name: "Add goal", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const calls = JSON.parse(
      (await page.getByRole("status", { name: "Goal calls" }).textContent())!,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0].creationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[1].creationId).toBe(calls[0].creationId);
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Remove goal", exact: true }).click();
    await expect(confirm.getByRole("alert")).toContainText("draft is retained");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Keep goal", exact: true }).click();
    await expect(confirm).not.toBeVisible();
  }
  expect(errors).toEqual([]);
});
