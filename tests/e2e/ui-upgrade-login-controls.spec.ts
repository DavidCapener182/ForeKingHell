import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Sign-in errors retain input and safe return context without implying success", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/login.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/login/actions": path.resolve("tests/fixtures/ui-upgrade/login-actions.ts"),
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
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("fixture@example.invalid");
    await page.locator('input[name="password"]').fill("synthetic-fixture-password");
    await page.getByRole("button", { name: "Show password", exact: true }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Sign in with password", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Synthetic invalid credentials");
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue(
      "fixture@example.invalid",
    );
    expect(
      await page.evaluate(() => (window as unknown as { authCalls: unknown[] }).authCalls),
    ).toEqual([{ email: "fixture@example.invalid", next: "/billing?from=fixture" }]);
    await page
      .getByRole("textbox", { name: "Email for a secure link", exact: true })
      .fill("magic@example.invalid");
    await page.getByRole("button", { name: "Email me a secure link", exact: true }).click();
    await expect(page.locator("#magic-login-message")).toContainText(
      "Check your inbox before trying again",
    );
    await expect(
      page.getByRole("textbox", { name: "Email for a secure link", exact: true }),
    ).toHaveValue("magic@example.invalid");
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P84-controls-${width}.png`) });
  }
});
