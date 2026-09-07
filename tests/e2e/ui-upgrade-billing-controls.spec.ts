import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Billing review makes no provider calls until confirmation and retains selection after errors", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/billing.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/billing/actions": path.resolve("tests/fixtures/ui-upgrade/billing-actions.ts"),
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
    await page.getByRole("combobox", { name: "Full plan billing interval" }).selectOption("yearly");
    await page.getByRole("button", { name: "Review Full plan", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Review Full plan" });
    await expect(dialog).toContainText("£119 per year");
    await dialog.getByRole("button", { name: "Keep current plan", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { billingCalls?: unknown[] }).billingCalls ?? [],
      ),
    ).toEqual([]);
    await page.getByRole("button", { name: "Review Full plan", exact: true }).click();
    for (let retry = 0; retry < 2; retry++) {
      await dialog
        .getByRole("button", { name: "Continue to secure checkout", exact: true })
        .click();
      await expect(dialog.getByRole("alert")).toContainText("Synthetic checkout unavailable");
    }
    expect(
      await page.evaluate(() => (window as unknown as { billingCalls: unknown[] }).billingCalls),
    ).toEqual([
      { planKey: "pro", interval: "yearly" },
      { planKey: "pro", interval: "yearly" },
    ]);
    await dialog.getByRole("button", { name: "Keep current plan", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Manage plan", exact: true }).click();
    const portal = page.getByRole("dialog", { name: "Manage your plan" });
    await portal.getByRole("button", { name: "Stay here", exact: true }).click();
    await expect(portal).toHaveCount(0);
    expect(
      await page.evaluate(() => (window as unknown as { portalCalls?: number }).portalCalls ?? 0),
    ).toBe(0);
    await page.getByRole("button", { name: "Manage plan", exact: true }).click();
    await portal.getByRole("button", { name: "Open customer portal", exact: true }).click();
    await expect(portal.getByRole("alert")).toContainText("Synthetic portal unavailable");
    await portal.getByRole("button", { name: "Stay here", exact: true }).click();
    await expect(portal).toHaveCount(0);
    if (width < 768) {
      await page.getByRole("button", { name: /Full.*Details/ }).click();
      await expect(page.getByRole("dialog", { name: "Subscription details" })).toContainText(
        "01 Jan 2026 – 01 Jan 2027",
      );
      await page.keyboard.press("Escape");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P75-controls-${width}.png`) });
  }
});
