import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Profile save failure retains draft and invalid photo preserves existing media", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/profile-edit.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/profile/actions": path.resolve("tests/fixtures/ui-upgrade/profile-actions.ts"),
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
    await page.getByRole("button", { name: "Edit profile", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Display name", exact: true })
      .fill("Retained profile draft");
    await dialog.getByLabel("Choose avatar image file", { exact: true }).setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("invalid image bytes"),
    });
    await expect(
      dialog
        .getByText(
          "That photo could not be loaded. Your previous photo is retained; retry or choose another image.",
          { exact: true },
        )
        .last(),
    ).toBeVisible();
    await expect(dialog.locator('input[name="avatarUrl"]')).toHaveValue("/saved-avatar.png");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Edit profile", exact: true }).click();
    await expect(dialog.getByRole("textbox", { name: "Display name", exact: true })).toHaveValue(
      "Retained profile draft",
    );
    await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Synthetic profile save failed");
    await expect(dialog.getByRole("textbox", { name: "Display name", exact: true })).toHaveValue(
      "Retained profile draft",
    );
    await dialog.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const calls = await page.evaluate(
      () => (window as unknown as { profileCalls: Record<string, string>[] }).profileCalls,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[1]).toMatchObject({
      displayName: "Retained profile draft",
      avatarUrl: "/saved-avatar.png",
    });
  }
});
