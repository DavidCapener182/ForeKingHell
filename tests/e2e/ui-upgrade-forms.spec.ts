import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

// The real React components and real compiled application CSS, in an isolated
// in-memory page. Form actions only update fixture state; no account or DB writes.
test("G10: confirmation, native form semantics, recovery and bounded dialogs", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "Six explicit viewport sizes in one browser.");
  test.setTimeout(180_000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/forms.tsx"], bundle: true, write: false,
    outdir: "output/fixture", jsx: "automatic", platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), { from: path.resolve("src/app/globals.css") });
  await page.route("https://forms.fixture/**", (route) => route.fulfill({
    contentType: "text/html", body: '<!doctype html><html lang="en" data-theme="clubhouse" style="--font-ui-source:Arial;--font-body:Arial"><head><title>Forms fixture</title></head><body><div id="root"></div></body></html>',
  }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const viewport of [
    {width: 1440, height: 900}, {width: 1280, height: 800},
    {width: 390, height: 844}, {width: 360, height: 800},
    {width: 1023, height: 800}, {width: 1024, height: 800},
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("https://forms.fixture/");
    await page.addStyleTag({content: css.css + bundle.outputFiles.filter((file) => file.path.endsWith(".css")).map((file) => file.text).join("\n")});
    await page.addScriptTag({content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text});
    const trigger = page.getByRole("button", {name: "Delete fixture", exact: true});
    await trigger.click();
    const confirmation = page.getByRole("alertdialog", {name: "Delete Fixture round?"});
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", {name: "Cancel", exact: true})).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("textbox", {name: "Round name", exact: true})).toHaveValue("Fixture round");
    await trigger.click();
    await confirmation.getByRole("button", {name: "Delete round", exact: true}).click();
    await expect(page.getByRole("status", {name: "Submissions"})).toHaveText("1");
    await expect(page.getByRole("status", {name: "Confirmed clicks"})).toHaveText("1");
    await expect(page.getByRole("status", {name: "Result", exact: true})).toHaveText("delete: Fixture round");
    await expect(page.getByRole("alert")).toContainText("draft is still here");
    await page.getByRole("textbox", {name: "Round name", exact: true}).fill("");
    await trigger.click();
    await expect(confirmation).not.toBeVisible();
    await expect(page.getByRole("status", {name: "Submissions"})).toHaveText("1");
    await page.getByRole("textbox", {name: "Round name", exact: true}).fill("Retained edited round");
    await expect(page.locator("[data-dirty-form-bar]")).toBeVisible();
    expect((await page.getByRole("textbox", {name: "Notes", exact: true}).boundingBox())!.height).toBeGreaterThanOrEqual(96);
    await page.getByRole("button", {name: "Open long form", exact: true}).click();
    const dialog = page.getByRole("dialog", {name: "Review the full round details"});
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    await dialog.getByRole("textbox", {name: "Hole 18", exact: true}).fill("5");
    const finalField = await dialog.getByRole("textbox", {name: "Hole 18", exact: true}).boundingBox();
    const footer = await dialog.locator('[data-slot="dialog-footer"]').boundingBox();
    expect(finalField!.y + finalField!.height).toBeLessThanOrEqual(footer!.y + 1);
    await expect(dialog.locator('[data-slot="dialog-footer"]').getByRole("button", {name: "Close", exact: true})).toBeInViewport();
    await page.screenshot({path: info.outputPath(`G10-${viewport.width}x${viewport.height}.png`)});
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", {name: "Open long form", exact: true})).toBeFocused();
    await page.getByRole("button", {name: /Club/}).click();
    await page.getByRole("option", {name: "7 iron", exact: true}).click();
    await page.getByRole("button", {name: "Apply comparison", exact: true}).click();
    await expect(page.getByRole("status", {name: "Adapter result"})).toHaveText("Fixture golfer|7-iron|compare");
  }
  expect(errors).toEqual([]);
});
