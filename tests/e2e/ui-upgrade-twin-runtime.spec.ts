import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Course Twin fallback and communication recovery preserve selected state", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/twin-runtime.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    plugins: [
      {
        name: "stub-three-scene",
        setup(build) {
          build.onResolve({ filter: /^\.\/course-twin-scene$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/twin-scene-stub.tsx"),
          }));
        },
      },
    ],
    alias: {
      "next/navigation": path.resolve("tests/fixtures/ui-upgrade/twin-navigation.ts"),
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
  let gets = 0,
    posts = 0;
  await page.route("https://twin.fixture/api/course-twins/rooms/synthetic-room/events", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      return route.fulfill({
        status: posts === 1 ? 503 : 200,
        contentType: "application/json",
        body: "{}",
      });
    }
    gets++;
    return route.fulfill({
      status: gets === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify({ events: [] }),
    });
  });
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
      gets = 0;
      posts = 0;
      await page.goto("https://twin.fixture/?quality=2d&hole=2");
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
      if (width >= 1024) {
        const plan = page.locator("[data-course-twin-low-power-fallback]");
        await expect(plan.getByRole("button", { name: "Hole 2", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await plan.getByRole("button", { name: "Hole 1", exact: true }).click();
        await expect(plan.getByRole("button", { name: "Hole 1", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await plan.locator("summary").click();
        await expect(
          plan.getByText("No measured shots on the selected hole.", { exact: true }),
        ).toBeVisible();
      } else {
        const plan = page.locator("[data-course-twin-mobile-overhead]");
        await expect(plan.getByRole("heading", { name: "Hole 2", exact: true })).toBeVisible();
        await plan.getByRole("button", { name: "Previous", exact: true }).click();
        await expect(plan.getByRole("heading", { name: "Hole 1", exact: true })).toBeVisible();
      }
      const options = page.getByRole("region", { name: "Fixture view settings" });
      await options.locator("summary").click();
      await options.getByLabel("Hole", { exact: true }).selectOption("2");
      await options.getByLabel("Camera", { exact: true }).selectOption("golfer");
      await expect(
        options.getByText("View options · 2 unsaved changes", { exact: true }),
      ).toBeVisible();
      await options.getByRole("button", { name: "Reset options", exact: true }).click();
      await expect(options.getByLabel("Hole", { exact: true })).toHaveValue("1");
      await options.getByLabel("Camera", { exact: true }).selectOption("golfer");
      await options.getByRole("button", { name: "Apply view", exact: true }).click();
      await expect(options.getByText("Hole 1 · Shot view", { exact: true })).toBeVisible();
      const room = page.getByRole("region", { name: "Fixture room" });
      await room
        .getByRole("textbox", { name: "Group chat message" })
        .fill("Synthetic retained draft");
      await room.getByRole("button", { name: "Send message", exact: true }).click();
      await expect(room.getByRole("alert")).toContainText("Message was not sent");
      await expect(room.getByRole("textbox", { name: "Group chat message" })).toHaveValue(
        "Synthetic retained draft",
      );
      if (width === 390)
        await page.screenshot({
          path: info.outputPath(`P54-draft-${surface}.png`),
          animations: "disabled",
          fullPage: true,
        });
      await room.getByRole("button", { name: "Send message", exact: true }).click();
      await expect(room.getByRole("textbox", { name: "Group chat message" })).toHaveValue("");
      expect(posts).toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`P54-${surface}-${width}.png`),
        animations: "disabled",
        fullPage: true,
      });
    }
  expect(errors).toEqual([]);
});
