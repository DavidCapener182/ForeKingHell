import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("Today lazy drawers open and restore focus at every required viewport", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(120000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/today-drawers.tsx"],
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
  await page.route("https://today-drawers.fixture/**", (route) =>
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
    await page.goto("https://today-drawers.fixture/");
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
    for (const name of ["Why this recommendation?", /7 iron:.*View comparison/]) {
      const trigger = page.getByRole("button", { name });
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      if (typeof name === "string") await expect(dialog).toContainText("Exact owned shot evidence");
      else {
        await expect(dialog).toContainText("155 yd");
        await dialog.getByRole("button", { name: "Latest evidence", exact: true }).click();
        await expect(dialog.getByRole("link", { name: /Latest owned session/ })).toBeVisible();
      }
      await dialog.getByRole("button", { name: "Done", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    await page.screenshot({
      path: info.outputPath(`today-drawers-${width}.png`),
      animations: "disabled",
    });
  }
  expect(errors).toEqual([]);
});
