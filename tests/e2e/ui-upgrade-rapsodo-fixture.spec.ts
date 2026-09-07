import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Rapsodo provider UI uses retained drafts and exact preview ID", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/rapsodo.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/rapsodo/actions": path.resolve("tests/fixtures/ui-upgrade/rapsodo-actions.ts"),
      "next/navigation": path.resolve("tests/fixtures/ui-upgrade/rapsodo-navigation.tsx"),
    },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://rapsodo.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Rapsodo fixture</title></head><body><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.log("FIXTURE PAGE ERROR", error.message);
  });
  for (const surface of ["workbench", "companion"])
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [390, 844],
      [360, 800],
      [1023, 800],
      [1024, 800],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto("https://rapsodo.fixture/");
      await page.evaluate(
        (value) => (document.documentElement.dataset.appSurface = value),
        surface,
      );
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
      await page
        .getByRole("textbox", { name: "Rapsodo email", exact: true })
        .fill("fixture@example.test");
      await page.getByLabel("Rapsodo password", { exact: true }).fill("synthetic-only");
      await page.getByRole("button", { name: "Sign in to R-Cloud", exact: true }).click();
      await expect(
        page.getByText("Synthetic connection failure; retry.", { exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Rapsodo password", { exact: true })).toHaveValue(
        "synthetic-only",
      );
      await page.getByRole("button", { name: "Sign in to R-Cloud", exact: true }).click();
      await page
        .getByRole("button", { name: "Preview Synthetic cloud course", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.locator("summary").filter({ hasText: "Shot 1" }).click();
      await expect(dialog.getByText("Ball speed (mph)", { exact: true })).toBeVisible();
      await dialog
        .getByRole("combobox", { name: "Review club for shot 1", exact: true })
        .selectOption("fixture-7i");
      await dialog.getByRole("button", { name: "Close and keep review", exact: true }).click();
      await page
        .getByRole("button", { name: "Resume review: Synthetic cloud course", exact: true })
        .click();
      await dialog.locator("summary").filter({ hasText: "Shot 1" }).click();
      await expect(
        dialog.getByRole("combobox", { name: "Review club for shot 1", exact: true }),
      ).toHaveValue("fixture-7i");
      await expect(dialog.getByText("Course import", { exact: true })).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`P37-${surface}-${width}.png`),
        animations: "disabled",
      });
      await dialog.getByRole("button", { name: "Save selected shots", exact: true }).last().click();
      await expect(
        page.getByText(/Saved receipt retained after metadata failure/).first(),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.dataset.importCalls)).toBe("1");
      const imported = await page.evaluate(() =>
        JSON.parse(document.documentElement.dataset.importInput!),
      );
      expect(imported.session.providerSessionId).toBe("fixture-remote-1");
      expect(imported.importInput.shotOverrides).toHaveLength(1);
    }
  expect(errors).toEqual([]);
});
