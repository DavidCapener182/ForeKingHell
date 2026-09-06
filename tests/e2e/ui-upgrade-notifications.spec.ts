import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { expect, test } from "@playwright/test";

test("G07: server-confirmed reads, failure recovery, dates and bounded drawer", async ({page}, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix.");
  test.setTimeout(180_000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const bundle=await build({entryPoints:["tests/fixtures/ui-upgrade/notifications.tsx"],bundle:true,write:false,outdir:"output/fixture",jsx:"automatic",platform:"browser",define:{"process.env":'{"NODE_ENV":"production"}'}});
  const css=await postcss([tailwind()]).process(readFileSync("src/app/globals.css","utf8"),{from:path.resolve("src/app/globals.css")});
  let failedWrite=true;
  let read=false;
  await page.route("https://notifications.fixture/**", async (route) => {
    if (route.request().url().endsWith("/api/desktop-workbench/notifications")) {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({ids:["fixture-invite"]});
        if (failedWrite) {failedWrite=false; return route.fulfill({status:503,json:{error:"Fixture rejected save"}});}
        read=true;
        return route.fulfill({json:{readIds:["fixture-invite"]}});
      }
      return route.fulfill({json:{items:[{id:"fixture-invite",title:"A long invitation title from the coastal golf fixture",detail:"Review this invitation without losing its person, date or selected entity.",href:"/challenges/fixture-invite",tone:"blue",unread:!read,createdAt:"2026-09-06T10:00:00Z"}]}});
    }
    return route.fulfill({contentType:"text/html",body:'<!doctype html><html lang="en" data-theme="clubhouse" style="--font-ui-source:Arial;--font-body:Arial"><head><title>Notification fixture</title></head><body><div id="root"></div></body></html>'});
  });
  for (const viewport of [{width:1440,height:900},{width:1280,height:800},{width:390,height:844},{width:360,height:800},{width:1023,height:800},{width:1024,height:800}]) {
    await page.setViewportSize(viewport);
    await page.goto("https://notifications.fixture/");
    await page.addStyleTag({content:css.css});
    await page.addScriptTag({content:bundle.outputFiles.find((file)=>file.path.endsWith(".js"))!.text});
    const trigger=page.getByRole("button",{name:/Open notifications/});
    await trigger.click();
    const drawer=page.getByRole("dialog",{name:"Notifications",exact:true});
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("time")).toHaveText("6 Sept 2026");
    await expect(drawer.getByRole("link",{name:/long invitation/})).toHaveAttribute("href","/challenges/fixture-invite");
    if (!read) {
      await drawer.getByRole("button",{name:"Mark all read",exact:true}).click();
      await expect(drawer.getByRole("alert")).toContainText("could not be saved");
      await expect(drawer.getByRole("button",{name:"Mark read",exact:true})).toBeEnabled();
      await drawer.getByRole("button",{name:"Mark all read",exact:true}).click();
    }
    await expect(drawer.getByText("0 unread",{exact:true})).toBeVisible();
    await expect(drawer.getByRole("button",{name:"Mark all read",exact:true})).toBeDisabled();
    await expect(drawer.getByRole("link",{name:"Notification preferences"})).toBeInViewport();
    await expect(drawer).toHaveCSS("opacity", "1");
    const bounds=await drawer.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.height).toBeLessThanOrEqual(viewport.height+1);
    await page.screenshot({path:info.outputPath(`G07-${viewport.width}.png`)});
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
  expect(errors).toEqual([]);
});
