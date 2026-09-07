import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Partner offer review preserves all fields through failed save and retry", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/partners.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/partners/actions": path.resolve("tests/fixtures/ui-upgrade/partner-actions.ts"),
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
    await page.getByRole("button", { name: "Create partner offer", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Create partner offer", exact: true });
    const form = panel.getByRole("form", { name: "Partner creation" });
    await form.getByRole("textbox", { name: "Offer title", exact: true }).fill("Synthetic offer");
    await form
      .getByRole("textbox", { name: "Offer terms and description", exact: true })
      .fill("Full fixture terms");
    await form
      .getByRole("textbox", { name: "Offer destination URL", exact: true })
      .fill("https://example.invalid/offer");
    await form.getByRole("textbox", { name: "Coupon code", exact: true }).fill("GOLF");
    await form.getByRole("button", { name: "Review creation", exact: true }).click();
    await expect(form).toContainText("exact-sponsor-id");
    await form.getByRole("button", { name: "Cancel review", exact: true }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { partnerCalls?: unknown[] }).partnerCalls ?? [],
      ),
    ).toEqual([]);
    await form.getByRole("button", { name: "Review creation", exact: true }).click();
    await form.getByRole("button", { name: "Confirm offer creation", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Synthetic creation unavailable");
    await form.getByRole("button", { name: "Confirm offer creation", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Offer created.");
    const calls = await page.evaluate(
      () => (window as unknown as { partnerCalls: Record<string, string>[] }).partnerCalls,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[0]).toMatchObject({
      operation: "offer",
      sponsorId: "exact-sponsor-id",
      title: "Synthetic offer",
      description: "Full fixture terms",
      offerUrl: "https://example.invalid/offer",
      couponCode: "GOLF",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P82-controls-${width}.png`) });
  }
});
