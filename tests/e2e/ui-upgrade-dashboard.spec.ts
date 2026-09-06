import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Requires authorised local fixture session");
test("P03 Dashboard UI remains available on both surfaces", async ({ page }, info) => {
 test.skip(info.project.name !== "chromium", "Explicit viewport matrix"); test.setTimeout(180000);
 const errors: string[]=[]; page.on("pageerror", e => {errors.push(e.stack ?? e.message); console.log(e.stack);});
 for (const surface of ["workbench","companion"]) {
  await page.goto(`/surface/${surface}?next=${encodeURIComponent("/dashboard")}`);
  await expect(page.locator("[data-dashboard-ui]")).toBeVisible({timeout:60000});
  for (const [width,height] of [[1440,900],[1280,800],[390,844],[360,800],[1023,800],[1024,800]]) {
   await page.setViewportSize({width,height});
   await expect(page.getByRole("heading",{level:1,name:"Dashboard",exact:true})).toHaveCount(1);
   await expect(page.locator("#practice")).toBeVisible();
   await page.evaluate(()=>scrollTo(0,0)); await page.screenshot({path:info.outputPath(`P03-${surface}-${width}.png`)});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1)).toBe(false);
   await expect(page.locator("#readiness")).toContainText("Mapped course and tees");
   await expect(page.locator("#changes [data-progress-comparison]")).toBeVisible();
  }
 }
 expect(errors).toEqual([]);
});
