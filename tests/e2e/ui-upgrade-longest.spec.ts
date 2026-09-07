import {expect,test} from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS!=="1","Authorised fixture required");
test("PB board and ledger follow the same distance record",async({page},info)=>{
 test.skip(info.project.name!=="chromium");test.setTimeout(180000);const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
 for(const surface of ["workbench","companion"]){
  await page.goto(`/surface/${surface}?next=${encodeURIComponent('/bag/longest')}`);await expect(page.locator('[data-best-shots-board]')).toBeVisible({timeout:60000});
  for(const [width,height] of [[1440,900],[1280,800],[390,844],[360,800],[1023,800],[1024,800]]){
   await page.setViewportSize({width,height});
   for(const metric of ["total","carry"]){
    await page.getByRole("button",{name:new RegExp(`longest ${metric}:`)}).first().click();await expect(page.locator('[data-pb-evidence-metric]')).toHaveAttribute('data-pb-evidence-metric',metric);
    await expect(page.getByRole('heading',{name:`${metric==='carry'?'Carry':'Total'} PB evidence board`,exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
   }
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath(`P11-${surface}-${width}.png`)});
  }
  await page.setViewportSize({width:360,height:800});await page.getByRole('button',{name:'Full evidence',exact:true}).click();const sheet=page.getByRole('dialog');await expect(sheet.getByRole('tab',{name:'Source',exact:true})).toBeVisible({timeout:30000});await sheet.getByRole('button',{name:'Close evidence',exact:true}).click();await page.reload();await expect(page.locator('[data-pb-evidence-metric]')).toHaveAttribute('data-pb-evidence-metric','carry');
 }
 expect(errors).toEqual([]);
});
