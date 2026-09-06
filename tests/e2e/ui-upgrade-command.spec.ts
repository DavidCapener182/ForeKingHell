import { expect, test } from "@playwright/test";

test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Requires local authorised fixture session.");
test("G02/G03: collapsible sections and one search on both surfaces", async ({page}, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix.");
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  let fail = true;
  await page.route("**/api/desktop-workbench/commands", async (route) => {
    if (fail) return route.fulfill({status: 503, json: {items: []}});
    return route.fulfill({json: {items: [{title: "Coastal fixture session", href: "/sessions?selected=coastal-fixture", detail: "Authorised synthetic session with a long source description retained across both surfaces", group: "Sessions", keywords: "coastal fixture session", type: "session"}]}});
  });
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=%2Ftoday`);
    await expect(page.locator("[data-command-centre-ready]")).toHaveAttribute("data-command-centre-ready", "true");
    for (const viewport of [{width:1440,height:900},{width:1280,height:800},{width:390,height:844},{width:360,height:800},{width:1023,height:800},{width:1024,height:800}]) {
      await page.setViewportSize(viewport);
      await page.keyboard.press("Control+k");
      const dialog = page.getByRole("dialog", {name:"Command palette",exact:true});
      await expect(dialog).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      if (fail) {
        await expect(dialog.getByRole("alert")).toContainText("could not be loaded");
        fail = false;
        await dialog.getByRole("button",{name:"Retry search"}).click();
      }
      const input = dialog.getByRole("combobox",{name:"Search command palette"});
      await input.fill("Coastal");
      await expect(dialog.getByRole("link",{name:/Coastal fixture session/})).toBeVisible();
      await expect(dialog.getByRole("button",{name:"Close",exact:true})).toBeInViewport();
      const bounds=await dialog.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(viewport.height+1);
      await page.screenshot({path:info.outputPath(`G03-${surface}-${viewport.width}.png`)});
      await input.fill("No-such-fixture");
      await expect(dialog.getByText(/No matching command/)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  }
  await page.setViewportSize({width:360,height:800});
  const more=page.getByRole("button",{name:/Open more tools and profile/});
  await more.click();
  await page.getByRole("button",{name:"Search clubs, rounds and people"}).click();
  const palette=page.getByRole("dialog",{name:"Command palette",exact:true});
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/surface/workbench?next=%2Ftoday");
  const section=page.getByRole("button",{name:"Insights",exact:true});
  await expect(section).toHaveAttribute("aria-expanded","true");
  await section.click();
  await expect(section).toHaveAttribute("aria-expanded","false");
  await section.press("Enter");
  await expect(section).toHaveAttribute("aria-expanded","true");
});
