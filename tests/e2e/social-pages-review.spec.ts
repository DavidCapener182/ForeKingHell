import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("synthetic social components preserve search, mobile evidence and keyboard access", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Four-width Chromium fixture verification");
  test.setTimeout(180000);
  const stubs: Record<string, string> = {
    "next/link": `import React from 'react';export default function Link({children,prefetch,...props}){return React.createElement('a',props,children)}`,
    "next/navigation": `import {useSyncExternalStore} from 'react';const old=history.replaceState.bind(history);history.replaceState=(...args)=>{old(...args);dispatchEvent(new PopStateEvent('popstate'))};const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};export const usePathname=()=>location.pathname;export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''))};export const useRouter=()=>({refresh(){},push(){throw Error('Fixture navigation disabled')}});`,
    "@/components/app/desktop-workbench-controls": `export function DesktopWorkbenchControls(){return null}`,
    "@/app/friends/friend-action-menu": `import React from 'react';export function PeopleActionMenu(){return React.createElement('button',{type:'button',disabled:true},'Synthetic connection action')}`,
    "@/app/social-intelligence/actions": `export async function socialIntelligenceFormAction(){throw Error('Fixture writes disabled')}`,
  };
  const bundle = await build({
    entryPoints: ["tests/fixtures/ui-upgrade/social-pages.tsx"],
    bundle: true,
    write: false,
    outdir: "output/fixture-social",
    jsx: "automatic",
    platform: "browser",
    define: { "process.env": JSON.stringify({ NODE_ENV: "production" }) },
    plugins: [
      {
        name: "synthetic-navigation-and-actions",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) =>
            stubs[args.path] ? { path: args.path, namespace: "social-stub" } : null,
          );
          build.onLoad({ filter: /.*/, namespace: "social-stub" }, (args) => ({
            contents: stubs[args.path],
            loader: "js",
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://social-pages.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en" data-theme="clubhouse"><head><title>Synthetic social page review</title></head><body style="font-family:system-ui,sans-serif"><div id="root"></div></body></html>',
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  mkdirSync("output/page-review-social", { recursive: true });
  for (const width of [390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("https://social-pages.fixture/review");
    await page.addStyleTag({ content: css.css });
    for (const file of bundle.outputFiles.filter((file) => file.path.endsWith(".css")))
      await page.addStyleTag({ content: file.text });
    await page.addScriptTag({
      content: bundle.outputFiles.find((file) => file.path.endsWith(".js"))!.text,
    });
    await expect(page.getByText("SYNTHETIC SOCIAL PAGE FIXTURE")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "No golfers match" })).toBeVisible();
    const group = page.getByRole("region", { name: "Synthetic group roster" });
    if (width < 768) {
      await expect(group.getByText("Weekly points: 0", { exact: true })).toBeVisible();
      await expect(group.getByText("Weekly points: Not recorded", { exact: true })).toBeVisible();
    }
    const shared = page.getByRole("region", { name: "Synthetic shared sessions" });
    if (width < 768) {
      await expect(shared.getByText("Scorecard total: 84", { exact: true })).toBeVisible();
      await expect(
        shared.getByText("Scorecard total: Incomplete / unavailable", { exact: true }),
      ).toBeVisible();
    }
    await shared.getByRole("textbox", { name: "Search recent sessions" }).fill("not-found");
    await expect(shared.getByText("No sessions match this search.")).toBeVisible();
    await shared.getByRole("textbox", { name: "Search recent sessions" }).fill("");
    await expect(page.getByRole("button", { name: "Generate recap", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Report content", exact: true })).toBeEnabled();
    await group.getByRole("textbox", { name: "Search members" }).focus();
    await page.keyboard.type("no-match");
    await expect(group.getByRole("status")).toHaveText("No members match this search.");
    await group.getByRole("textbox", { name: "Search members" }).fill("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: `output/page-review-social/synthetic-social-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
