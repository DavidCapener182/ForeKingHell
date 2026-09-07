import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Account management retains exact reviewed identity and authoritative state on failure", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/admin-users.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/admin/actions": path.resolve("tests/fixtures/ui-upgrade/admin-actions.ts"),
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
    const trigger =
      width < 768
        ? page.getByRole("button", { name: /Synthetic target player.*Details/ })
        : page.getByRole("button", {
            name: "Account details for Synthetic target player",
            exact: true,
          });
    await trigger.click();
    const panel = page.getByRole("dialog", { name: "Synthetic target player" });
    await expect(panel).toContainText("target@example.invalid");
    await expect(panel).toContainText("01 Jan 2026");
    const form = panel.getByRole("form", { name: "Apply admin role", exact: true });
    await form.getByRole("combobox", { name: "Admin role", exact: true }).selectOption("operator");
    await form.getByRole("button", { name: "Review apply admin role", exact: true }).click();
    await expect(form).toContainText("Account ID");
    await form.getByRole("button", { name: "Cancel review", exact: true }).click();
    expect(
      await page.evaluate(() => (window as unknown as { adminCalls?: unknown[] }).adminCalls ?? []),
    ).toEqual([]);
    await form.getByRole("button", { name: "Review apply admin role", exact: true }).click();
    await form.getByRole("button", { name: "Confirm apply admin role", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Synthetic action unavailable");
    await expect(panel.locator("dd").filter({hasText:/^None$/})).toBeVisible();
    await form.getByRole("button", { name: "Confirm apply admin role", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Admin access granted.");
    expect(
      await page.evaluate(() => (window as unknown as { adminCalls: unknown[] }).adminCalls),
    ).toEqual([
      {
        email: "target@example.invalid",
        userId: "target",
        role: "operator",
        operation: "grant-admin",
      },
      {
        email: "target@example.invalid",
        userId: "target",
        role: "operator",
        operation: "grant-admin",
      },
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P77-controls-${width}.png`) });
  }
});
