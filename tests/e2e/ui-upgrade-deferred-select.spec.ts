import { build } from "esbuild";
import { expect, test } from "@playwright/test";

test("deferred Select preserves cold keyboard opening, native validation and modal focus", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(120_000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/deferred-select.tsx"],
    bundle: true,
    splitting: true,
    format: "esm",
    write: false,
    outdir: "/tmp/select-fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  let release: (() => void) | undefined;
  let deferredRequests = 0;
  let failChunk = false;
  let gate: Promise<void> | undefined;
  await page.route("https://select.fixture/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const file = bundle.outputFiles.find((file) => file.path.endsWith(pathname));
    if (file) {
      if (pathname.includes("deferred-select-") && pathname.endsWith(".js")) {
        deferredRequests++;
        if (failChunk) {
          await route.abort("failed");
          return;
        }
        if (gate) await gate;
      }
      await route.fulfill({
        contentType: pathname.endsWith(".css") ? "text/css" : "text/javascript",
        body: file.text,
      });
    } else
      await route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><head><link rel="stylesheet" href="/deferred-select.css"></head><body><div id="root"></div><script type="module" src="/deferred-select.js"></script></body></html>',
      });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 1023, height: 800 },
    { width: 1024, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    deferredRequests = 0;
    gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.goto("https://select.fixture/");
    const trigger = page.getByRole("button", { name: "Driver Club", exact: true });
    await expect(trigger).toBeVisible();
    expect(deferredRequests).toBe(0);
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByRole("status", { name: "Result" })).toHaveText("driver");
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(trigger).toHaveAttribute("aria-busy", "true");
    release!();
    gate = undefined;
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(page.getByRole("option", { name: "Unavailable", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole("option", { name: "7 iron", exact: true }).click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByRole("status", { name: "Result" })).toHaveText("iron");
    await page.getByRole("button", { name: "Open modal", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Club editor" });
    await dialog.getByRole("button", { name: "Driver Modal club", exact: true }).click();
    await expect(dialog.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      dialog.getByRole("button", { name: "Driver Modal club", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
  }
  // Delayed required menu must not permit submitting an empty selection.
  gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto("https://select.fixture/?required");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("status", { name: "Result" })).toBeEmpty();
  const native = page.getByRole("combobox", { name: "Club", exact: true });
  await native.selectOption("iron");
  release!();
  gate = undefined;
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("status", { name: "Result" })).toHaveText("iron");
  // Moving on while the chunk loads must not steal keyboard focus on arrival.
  gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto("https://select.fixture/");
  await page.getByRole("button", { name: "Driver Club", exact: true }).click();
  await page.getByRole("button", { name: "Other focus", exact: true }).focus();
  release!();
  gate = undefined;
  await expect(page.getByRole("button", { name: "Driver Club", exact: true })).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.getByRole("button", { name: "Other focus", exact: true })).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  // A failed enhanced-menu download leaves a complete native form task.
  failChunk = true;
  await page.goto("https://select.fixture/");
  await page.getByRole("button", { name: "Driver Club", exact: true }).click();
  await page.getByRole("combobox", { name: "Club", exact: true }).selectOption("iron");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("status", { name: "Result" })).toHaveText("iron");
  expect(errors).toEqual([]);
});
