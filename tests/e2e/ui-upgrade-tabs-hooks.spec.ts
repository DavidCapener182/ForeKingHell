import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("Underline tabs retain drafts and accessible keyboard selection at every required viewport", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(120000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/tabs-hooks.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://tabs.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Tabs fixture</title></head><body><div id="root"></div></body></html>',
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
    await page.goto("https://tabs.fixture/");
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
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(4);
    await page.getByRole("textbox", { name: "Practice draft" }).fill("Retain my unsaved reading");
    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(tabs.last()).toBeFocused();
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAccessibleName(
      "Detailed review and corrections",
    );
    expect(
      await tabs.last().evaluate((el) => {
        const p = el.parentElement!.parentElement!;
        const a = el.getBoundingClientRect(),
          b = p.getBoundingClientRect();
        return a.right <= b.right + 1 && a.left >= b.left - 1;
      }),
    ).toBeTruthy();
    expect(
      await tabs.evaluateAll((nodes) =>
        nodes.every((tab) => {
          const panel = document.getElementById(tab.getAttribute("aria-controls")!);
          return panel?.getAttribute("aria-labelledby") === tab.id;
        }),
      ),
    ).toBeTruthy();
    await page.keyboard.press("Home");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("textbox", { name: "Practice draft" })).toHaveValue(
      "Retain my unsaved reading",
    );
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await expect(page.locator('[role="tabpanel"][hidden][inert]')).toHaveCount(3);
    await page.getByRole("checkbox", { name: "Disable tabs" }).check();
    for (let i = 0; i < 4; i++) await expect(tabs.nth(i)).toHaveAttribute("aria-disabled", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await page.getByRole("checkbox", { name: "Disable tabs" }).uncheck();
    await tabs.nth(2).click();
    await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Historical source records");
    await page.screenshot({ path: info.outputPath(`tabs-${width}.png`), animations: "disabled" });
  }
  expect(errors).toEqual([]);
});
