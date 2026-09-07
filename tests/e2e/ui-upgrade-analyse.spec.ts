import { expect, test } from "@playwright/test";
test("Analysis overview retains provenance and scoped entry points", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium");
  test.setTimeout(120000);
  await page.goto("/surface/workbench?next=/analyse");
  await expect(page.getByRole("heading", {name:"Analysis",exact:true})).toBeVisible({timeout:60000});
  for (const [width,height] of [[1440,900],[1280,800],[390,844],[360,800],[1023,800],[1024,800]]) {
    await page.setViewportSize({width,height});
    await page.getByRole("button",{name:"Evidence & calculation",exact:true}).click();
    await expect(page.getByRole("dialog")).toContainText("Trusted shots");
    await expect(page.getByRole("dialog").getByRole("link",{name:"Review data quality",exact:true})).toHaveAttribute("href","/analyse/workspace");
    await page.getByRole("dialog").getByRole("button",{name:"Close details",exact:true}).last().click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("img",{name:/illustrative miss-direction sketch/})).toBeVisible();
    const compare=page.getByRole("link").filter({hasText:"Open comparison lab"});
    expect(await compare.getAttribute("href")).toContain("/analyse/compare");
    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:info.outputPath(`P22-workbench-${width}.png`),animations:"disabled"});
  }
});
