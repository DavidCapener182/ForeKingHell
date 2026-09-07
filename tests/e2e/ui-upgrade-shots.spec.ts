import { expect, test } from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1", "Authorised local fixture required");
test("P06 full shot scope and evidence across both surfaces",async({page},info)=>{
 test.skip(info.project.name!=="chromium");test.setTimeout(180000);
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.stack??e.message));
 for(const surface of ["workbench","companion"]){
  await page.goto(`/surface/${surface}?next=${encodeURIComponent("/shots")}`);
  await expect(page.getByRole("heading",{level:1,name:"Shots",exact:true})).toBeVisible({timeout:60000});
  for(const [width,height] of [[1440,900],[1280,800],[390,844],[360,800],[1023,800],[1024,800]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
   await expect(page.locator("[data-shot-filter-toolbar]")).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
   await page.screenshot({path:info.outputPath(`P06-${surface}-${width}.png`)});
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Filters",exact:true}).click();
  const filters=page.getByRole("dialog",{name:"Filter shots"});await expect(filters).toBeVisible();
  await expect(filters.getByText("Review state",{exact:true})).toBeVisible();
  await expect(filters.getByRole("button",{name:"Apply filters",exact:true})).toBeVisible();
  await filters.getByRole("button",{name:"Cancel",exact:true}).click();
  const row=page.locator("[data-mobile-shot-explorer] button.mobile-shot-row").first();
  if(await row.count()){
   await row.click();const detail=page.getByRole("dialog");
   for(const name of ["Flight","Source","History"]){await detail.getByRole("tab",{name,exact:true}).click();await expect(detail.getByRole("tab",{name,exact:true})).toHaveAttribute("data-state","active");}
   await expect(detail.getByText("Correct club",{exact:true})).toBeVisible();
   await page.screenshot({path:info.outputPath(`P06-${surface}-history-390.png`)});
   await detail.getByRole("button",{name:"Done",exact:true}).first().click();await expect(row).toBeFocused();
  }
  await page.getByRole("searchbox",{name:"Search shots",exact:true}).fill("no-matching-shot-fixture-98765");
  await page.getByRole("button",{name:"Search / apply",exact:true}).click();
  await expect(page.getByRole("heading",{name:"No matching shots",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Clear filters",exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("searchbox",{name:"Search shots",exact:true})).toHaveValue("no-matching-shot-fixture-98765");
  await page.getByRole("button",{name:"Clear all",exact:true}).click();await expect(page).not.toHaveURL(/q=/);
 }
 expect(errors).toEqual([]);
});
