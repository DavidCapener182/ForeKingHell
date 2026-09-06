import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("P01 controls: measured zero, explicit scope, drawer and table on six viewports", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix");
  test.setTimeout(180_000);
  page.setDefaultTimeout(10_000);
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/progress.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [
      {
        name: "fixture-navigation",
        setup(build) {
          build.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: path.resolve("tests/fixtures/ui-upgrade/progress-navigation.ts"),
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://progress.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse" style="--font-ui-source:Arial;--font-body:Arial"><head><title>Progress fixture</title></head><body><div id="root"></div></body></html>',
    }),
  );
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
    await page.goto(
      "https://progress.fixture/progress?compareClub=coastal-7i&compareMeasure=carry",
    );
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
    await expect(page.locator("[data-progress-tabs]")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("[data-progress-snapshot]")).toContainText("0 / 100");
    await expect(
      page.getByText("Holding steady between these sessions", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /1 Aug 2026/ }).click();
    await expect(page.locator("[data-selected-observation]")).toContainText("1 Aug 2026");
    await expect(page.locator("[data-selected-observation]").getByRole("link")).toHaveAttribute(
      "href",
      "/sessions/before",
    );
    await page.getByRole("button", { name: /Comparison measure/ }).click();
    await page.getByRole("option", { name: "Total", exact: true }).click();
    await expect(page.locator("[data-selected-observation]")).toContainText("165 yd");
    await expect(page.getByText("Building a comparable baseline", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Period filters (0)" }).click();
    const drawer = page.getByRole("dialog", { name: "Comparison period" });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("From", { exact: true }).fill("2026-09-01");
    await drawer.getByRole("button", { name: "Apply period" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByText(/No measured total values in this period/)).toBeVisible();
    expect(new URL(page.url()).searchParams.get("compareClub")).toBe("coastal-7i");
    await page.getByRole("button", { name: "Period filters (1)" }).click();
    await drawer.getByRole("button", { name: "Reset period" }).click();
    await drawer.getByRole("button", { name: "Apply period" }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("button", { name: /Comparison measure/ })).toContainText("Total");
    await page.getByRole("button", { name: /Comparison measure/ }).click();
    await page.getByRole("option", { name: "Carry", exact: true }).click();
    await page.getByText("View measured values as a table", { exact: true }).click();
    await expect(page.getByRole("table")).toContainText("150");
    await page.getByRole("searchbox", { name: "Search clubs" }).fill("absent");
    await expect(page.getByText(/No clubs match your search/)).toBeVisible();
    await page.getByRole("searchbox", { name: "Search clubs" }).fill("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`P01-controls-${viewport.width}.png`) });
    await page.getByRole("tab",{name:"Timeline",exact:true}).click();
    const timeline=page.locator("[data-progress-timeline-story]");
    await expect(timeline.getByRole("listitem")).toHaveCount(12);
    await timeline.getByRole("button",{name:"Load more events (3 remaining)"}).click();
    await expect(timeline.getByRole("listitem")).toHaveCount(15);
    await timeline.getByRole("button",{name:/Event type/}).click();
    await page.getByRole("option",{name:"Practice",exact:true}).click();
    await expect(timeline.getByRole("listitem")).toHaveCount(8);
    await timeline.scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`P01-timeline-${viewport.width}.png`)});
    if(viewport.width===1440 || viewport.width===360) {
      await page.evaluate(() => {document.documentElement.dataset.theme="dark";document.documentElement.style.zoom="2";});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth+1)).toBe(true);
      await page.screenshot({path:info.outputPath(`P01-timeline-css-zoom-dark-${viewport.width}.png`)});
    }
  }
  expect(errors).toEqual([]);
});
