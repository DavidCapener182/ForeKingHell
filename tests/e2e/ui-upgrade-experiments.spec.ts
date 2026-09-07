import {expect,test} from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_E2E_AUTH_BYPASS!=="1","Authorised fixture required");
test("Experiment Lab requires two explicit sessions and exposes the decision form",async({page},info)=>{
 test.skip(info.project.name!=="chromium");test.setTimeout(180000);const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
 for(const surface of ["workbench","companion"]){
  await page.goto(`/surface/${surface}?next=/equipment/experiments`);await expect(page.getByRole('heading',{name:'Equipment Experiment Lab',exact:true})).toBeVisible({timeout:60000});await expect(page.getByRole('button',{name:'Compare setups',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/1\. Current setup baseline/}).click();await page.getByRole('option').nth(1).click();await page.getByRole('button',{name:/2\. Test setup session/}).click();await page.getByRole('option').nth(1).click();await expect(page.getByRole('alert').filter({hasText:'Choose two different sessions.'})).toBeVisible();await expect(page.getByRole('button',{name:'Compare setups',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:/2\. Test setup session/}).click();await page.getByRole('option').nth(2).click();await page.getByRole('button',{name:'Compare setups',exact:true}).click();await expect(page.getByRole('button',{name:'Save decision',exact:true})).toBeVisible();
  for(const [width,height] of [[1440,900],[1280,800],[390,844],[360,800],[1023,800],[1024,800]]){await page.setViewportSize({width,height});await expect(page.getByText('Check whether the test is fair',{exact:true})).toBeVisible();await page.getByLabel('Decision name',{exact:true}).fill('UI draft - do not save');await page.getByLabel('Notes and saved equipment decision',{exact:true}).fill('Evidence needs review - do not save.');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:info.outputPath(`P14-${surface}-${width}.png`)});}
 }
 await page.goto('/equipment/experiments?snapshotId=00000000-0000-0000-0000-000000000000');await expect(page.getByRole('heading',{name:'Saved decision unavailable',exact:true})).toBeVisible();expect(errors).toEqual([]);
});
