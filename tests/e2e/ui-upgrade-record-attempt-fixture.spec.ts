import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Record submission keeps derived score and proof drafts through failure", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/record-attempt.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/course-records/actions": path.resolve(
        "tests/fixtures/ui-upgrade/record-attempt-actions.ts",
      ),
      "next/navigation": path.resolve("tests/fixtures/ui-upgrade/record-navigation.ts"),
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
  let extracts = 0;
  await page.route("https://twin.fixture/api/scorecard/extract", (route) => {
    extracts++;
    const input = route.request().postDataJSON();
    expect(input.proofScopeId).toBe("synthetic-record");
    return route.fulfill({
      status: extracts === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        extracts === 1
          ? { message: "Synthetic extraction failure" }
          : {
              scorecard: { totalScore: 42, courseName: "Synthetic fixture course" },
              proofToken: "synthetic-signed-proof",
            },
      ),
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
      extracts = 0;
      await page.goto("https://twin.fixture/");
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
      const form = page.locator("[data-course-record-attempt-form]");
      await page.getByRole("button", { name: "Change saved round", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("combobox", { name: "Saved round", exact: true })
        .selectOption("round-2");
      await dialog.getByRole("button", { name: "Use selected round", exact: true }).click();
      await expect(form.locator("[data-record-derived-score]")).toHaveText("42 strokes");
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=",
        "base64",
      );
      await form.locator('input[type="file"]').setInputFiles({
        name: "synthetic-long-scorecard-name-for-proof-review.png",
        mimeType: "image/png",
        buffer: png,
      });
      await expect(form.getByRole("alert")).toContainText("Synthetic extraction failure");
      await form.getByRole("button", { name: "Retry image", exact: true }).click();
      await expect(form.locator('input[name="scorecardProofToken"]')).toHaveValue(
        "synthetic-signed-proof",
      );
      await form.locator('input[type="file"]').setInputFiles({
        name: "invalid.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("synthetic"),
      });
      await expect(form.locator('input[name="scorecardProofToken"]')).toHaveValue("");
      await expect(form.locator('input[name="extractedScorecardTotal"]')).toHaveValue("");
      await form
        .locator('input[type="file"]')
        .setInputFiles({ name: "synthetic-retry.png", mimeType: "image/png", buffer: png });
      await expect(form.locator('input[name="scorecardProofToken"]')).toHaveValue(
        "synthetic-signed-proof",
      );
      await form.getByRole("button", { name: "Review attempt", exact: true }).click();
      await form.getByRole("button", { name: "Remove image", exact: true }).click();
      await expect(
        form.getByRole("button", { name: "Submit reviewed attempt", exact: true }),
      ).toHaveCount(0);
      await expect(form.locator('input[name="scorecardProofToken"]')).toHaveValue("");
      await form
        .locator('input[type="file"]')
        .setInputFiles({
          name: "too-large.png",
          mimeType: "image/png",
          buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
        });
      await expect(form.getByRole("alert")).toContainText("exceeds 5 MB");
      await form
        .locator('input[type="file"]')
        .setInputFiles({ name: "synthetic-final.png", mimeType: "image/png", buffer: png });
      await expect(form.locator('input[name="scorecardProofToken"]')).toHaveValue(
        "synthetic-signed-proof",
      );
      await form.getByRole("button", { name: "Review attempt", exact: true }).click();
      await form.getByRole("button", { name: "Submit reviewed attempt", exact: true }).click();
      await expect(form.getByRole("alert")).toContainText("Synthetic save failure");
      await expect(form.locator('input[name="sessionId"]')).toHaveValue("round-2");
      await expect(form.locator('input[name="scorecardProofToken"]')).toHaveValue(
        "synthetic-signed-proof",
      );
      await form.getByRole("button", { name: "Submit reviewed attempt", exact: true }).click();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.dataset.attemptSaved))
        .toBe("true");
      const calls = await page.evaluate(() =>
        JSON.parse(document.documentElement.dataset.attemptCalls!),
      );
      expect(calls).toHaveLength(2);
      expect(calls[0].requestId).toBe(calls[1].requestId);
      expect(calls[0].sessionId).toBe("round-2");
      expect(calls[0].recordId).toBe("synthetic-record");
      await page.screenshot({
        path: info.outputPath(`P57-${surface}-${width}.png`),
        animations: "disabled",
        fullPage: true,
      });
    }
  expect(errors).toEqual([]);
});
