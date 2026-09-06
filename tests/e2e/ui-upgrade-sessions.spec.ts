import {expect,test} from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1","Requires authorised local fixture");
test("P04 History UI and scoped shot detail",async({page},info)=>{
 test.skip(info.project.name!=="chromium","Explicit viewport matrix");test.setTimeout(180000);
 const errors:string[]=[];page.on("pageerror",error=>{errors.push(error.stack??error.message);console.log(error.stack);});
 for(const surface of ["workbench","companion"]){
  await page.goto(`/surface/${surface}?next=${encodeURIComponent("/sessions")}`);
  await expect(page.getByRole("heading",{level:1,name:"History",exact:true})).toBeVisible({timeout:60000});
  for(const [width,height] of [[1440,900],[1280,800],[390,844],[360,800],[1023,800],[1024,800]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
   await expect(page.getByRole("searchbox",{name:"Search history"})).toBeVisible();
   await page.screenshot({path:info.outputPath(`P04-${surface}-${width}.png`)});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  }
  await page.setViewportSize({width:390,height:844});
  if(surface==="workbench") await page.getByText("Inspect shot measurements and source",{exact:true}).click();
  else await page.getByRole("button",{name:"Preview shot evidence",exact:true}).first().click();
  const preview=page.locator("[data-session-shot-preview]").filter({visible:true});
  await expect(preview).toContainText(/\d+ shots · Page/,{timeout:30000});
  const shot=preview.getByRole("button").filter({hasText:"Tap for source and all fields"}).first();
  if(await shot.count()){
   await shot.click();await expect(page.getByRole("region",{name:"Selected shot detail"})).toBeVisible();
   await page.screenshot({path:info.outputPath(`P04-${surface}-390-shot.png`)});
   await page.getByRole("button",{name:"Close shot details",exact:true}).click();
  }
  if(surface==="companion")await page.getByRole("button",{name:"Close preview",exact:true}).click();
  await page.getByRole("searchbox",{name:"Search history"}).fill("no-such-session-ui-fixture");
  await expect(page).toHaveURL(/q=no-such-session-ui-fixture/);
  await expect(page.getByText("No sessions match these filters",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Clear all",exact:true}).click();
  await expect(page).not.toHaveURL(/q=/);
 }
 const unavailable=await page.request.get("/api/sessions/00000000-0000-0000-0000-000000000000/preview-shots");expect(unavailable.status()).toBe(404);
 expect(errors).toEqual([]);
});
