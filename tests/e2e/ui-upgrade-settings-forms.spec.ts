import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";
test("Settings retains section drafts and reviews exact invitations across widths", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/settings.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    alias: {
      "@/app/settings/actions": path.resolve("tests/fixtures/ui-upgrade/settings-actions.ts"),
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
    await page.getByRole("button", { name: "General", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Display name", exact: true })
      .fill("Retained settings draft");
    await page
      .getByRole("combobox", { name: "Preferred units", exact: true })
      .selectOption("metres");
    await page.getByRole("button", { name: "All settings sections", exact: true }).click();
    await page.getByRole("button", { name: "Sharing", exact: true }).click();
    await page.getByRole("button", { name: "All settings sections", exact: true }).click();
    await page.getByRole("button", { name: "General", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Display name", exact: true })).toHaveValue(
      "Retained settings draft",
    );
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Synthetic settings failure");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Settings saved.");
    await expect(page.locator("[data-dirty-form-bar]")).toHaveCount(0);
    await page.evaluate(()=>sessionStorage.setItem("fkh:theme-preview","dark"));
    await page.getByRole("textbox",{name:"Display name",exact:true}).fill("Discard only this general draft");
    await page.getByRole("button",{name:"Reset",exact:true}).click();
    expect(await page.evaluate(()=>sessionStorage.getItem("fkh:theme-preview"))).toBe("dark");
    await page.getByRole("button", { name: "All settings sections", exact: true }).click();
    await page.getByRole("button", { name: "Sharing", exact: true }).click();
    await page.getByRole("button", { name: "Invite collaborator", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Invite email", exact: true })
      .fill("synthetic@example.test");
    await dialog.getByRole("combobox", { name: "Role", exact: true }).selectOption("editor");
    await dialog.getByRole("button", { name: "Review invitation", exact: true }).click();
    await expect(dialog).toContainText("synthetic@example.test");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { accessCalls?: unknown[] }).accessCalls ?? [],
      ),
    ).toEqual([]);
    await page.getByRole("button", { name: "Invite collaborator", exact: true }).click();
    await dialog.getByRole("button", { name: "Confirm invitation", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Invitation created");
    const calls = await page.evaluate(
      () => (window as unknown as { accessCalls: Record<string, string>[] }).accessCalls,
    );
    expect(calls).toEqual([
      { operation: "invite", invitedEmail: "synthetic@example.test", role: "editor" },
    ]);
    await expect(dialog.getByRole("textbox", { name: "Invitation link", exact: true })).toHaveValue(
      "https://twin.fixture/settings/invitations/synthetic-invite-token",
    );
  }
});
