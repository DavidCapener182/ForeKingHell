import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
import { recordOfferClick } from "@/lib/partners";
import { recordOfferClickAction } from "@/app/partners/actions";
const actor=vi.hoisted(()=>({id:""}));
vi.mock("@/lib/current-user",()=>({requireCurrentUserId:async()=>actor.id}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
const enabled=process.env.RUN_REDESIGN_DB_TESTS==="1";
const url=process.env.DATABASE_URL;
if(enabled){const target=new URL(url!);if(target.hostname!=="127.0.0.1"||target.port!=="55432"||target.pathname!=="/fkh_redesign")throw new Error("Disposable local database required");}
let sql:ReturnType<typeof postgres>;
beforeAll(()=>{if(enabled)sql=postgres(url!,{max:1});});
afterAll(async()=>{if(enabled){await closeDb();await sql.end();}});
it.skipIf(!enabled)("uses canonical active offer destination and never records unavailable offers",async()=>{
 const offers:string[]=[];
 actor.id=(await sql`insert into fkh_users(name) values('Synthetic partner click') returning id`)[0].id;
 try{
  const offer=(await sql`insert into fkh_partner_offers(title,offer_url) values('Synthetic offer','https://example.invalid/canonical') returning id`)[0].id;offers.push(offer);
  const form=new FormData();form.set('offerId',offer);form.set('offerUrl','https://example.invalid/forged');form.set('source','x'.repeat(100));
  await expect(recordOfferClickAction(form)).rejects.toMatchObject({digest:expect.stringContaining('https://example.invalid/canonical')});
  const clicks=await sql`select user_id,source from fkh_offer_clicks where offer_id=${offer}`;
  expect(clicks).toHaveLength(1);expect(clicks[0]).toEqual({user_id:actor.id,source:'x'.repeat(80)});
  await sql`update fkh_partner_offers set active=false where id=${offer}`;
  await expect(recordOfferClick(offer)).rejects.toThrow('no longer available');
  await expect(recordOfferClick(crypto.randomUUID())).rejects.toThrow('no longer available');
  await sql`update fkh_partner_offers set active=true,offer_url='javascript:alert(1)' where id=${offer}`;
  await expect(recordOfferClick(offer)).rejects.toThrow('available destination');
  expect(await sql`select id from fkh_offer_clicks where offer_id=${offer}`).toHaveLength(1);
  await sql`update fkh_partner_offers set offer_url=null where id=${offer}`;
  expect(await recordOfferClick(offer)).toBeNull();
  expect(await sql`select id from fkh_offer_clicks where offer_id=${offer}`).toHaveLength(2);
 }finally{if(offers.length)await sql`delete from fkh_partner_offers where id in ${sql(offers)}`;await sql`delete from fkh_users where id=${actor.id}`;}
});
