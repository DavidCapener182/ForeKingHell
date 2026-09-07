import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Lifetime grant resolves a named account before review and retains exact identity on failure", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/admin-billing.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/admin/actions": path.resolve("tests/fixtures/ui-upgrade/admin-billing-actions.ts"),
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
    await page
      .getByRole("textbox", { name: "Account email", exact: true })
      .fill("missing@example.invalid");
    await page.getByRole("button", { name: "Find account", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("No user exists");
    await page
      .getByRole("textbox", { name: "Account email", exact: true })
      .fill("target@example.invalid");
    await page.getByRole("button", { name: "Find account", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Lifetime Full for Resolved synthetic player" });
    await expect(panel).toContainText("target-id");
    await expect(panel).toContainText("target@example.invalid");
    expect(
      await page.evaluate(() => (window as unknown as { grantCalls?: unknown[] }).grantCalls ?? []),
    ).toEqual([]);
    const form = panel.getByRole("form", { name: "Grant lifetime full", exact: true });
    await form.getByRole("button", { name: "Review grant lifetime full", exact: true }).click();
    await form.getByRole("button", { name: "Cancel review", exact: true }).click();
    expect(
      await page.evaluate(() => (window as unknown as { grantCalls?: unknown[] }).grantCalls ?? []),
    ).toEqual([]);
    await form.getByRole("button", { name: "Review grant lifetime full", exact: true }).click();
    await form.getByRole("button", { name: "Confirm grant lifetime full", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Synthetic grant unavailable");
    await form.getByRole("button", { name: "Confirm grant lifetime full", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Lifetime full access granted.");
    expect(
      await page.evaluate(() => (window as unknown as { grantCalls: unknown[] }).grantCalls),
    ).toEqual([
      { email: "target@example.invalid", userId: "target-id", operation: "grant-lifetime" },
      { email: "target@example.invalid", userId: "target-id", operation: "grant-lifetime" },
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P79-controls-${width}.png`) });
  }
});
