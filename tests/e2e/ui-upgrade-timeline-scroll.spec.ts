import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("long timelines scroll to their final event without covering following actions", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium");
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.log("TIMELINE ERROR", error.stack);
  });
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `import {createRoot} from 'react-dom/client'; import {useState} from 'react'; import {StatusTimeline} from './src/components/app/status-timeline'; function Fixture(){const [clicked,setClicked]=useState(false);return <main className="p-4"><h1>Timeline fixture</h1><StatusTimeline label="Recorded operations" className="max-h-80" items={Array.from({length:30},(_,i)=>({id:String(i),title:'Recorded operation '+(i+1),description:'Full evidence remains reachable.',kind:'import'}))}/><button className="min-h-11" onClick={()=>setClicked(true)}>Next history page</button><p role="status">{clicked?'Next page requested':'Ready'}</p></main>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), {
    from: path.resolve("src/app/globals.css"),
  });
  await page.route("https://timeline.fixture/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Timeline fixture</title></head><body><div id="root"></div></body></html>',
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
    await page.goto("https://timeline.fixture");
    await page.addStyleTag({ content: css.css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const region = page.getByRole("region", { name: "Recorded operations" });
    await expect(region.getByText("Recorded operation 1", { exact: true })).toBeInViewport();
    await page.getByRole("button", { name: "Next history page" }).click();
    await expect(page.getByRole("status")).toHaveText("Next page requested");
    const viewport = region.locator('[data-slot="scroll-area-viewport"]');
    await viewport.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(region.getByText("Recorded operation 30", { exact: true })).toBeInViewport();
    await page.getByRole("button", { name: "Next history page" }).focus();
    await expect(page.getByRole("button", { name: "Next history page" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`timeline-${width}.png`) });
  }
  expect(errors).toEqual([]);
});
