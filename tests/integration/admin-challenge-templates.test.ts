import { afterAll, beforeAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { createChallenge } from "@/lib/challenges";
import { closeDb } from "@/db/client";
import { saveAdminChallengeTemplate, type AdminChallengeTemplateInput } from "@/lib/admin-challenge-templates";
const actor=vi.hoisted(()=>({id:""}));
vi.mock("@/lib/current-user",()=>({requireCurrentUserId:async()=>actor.id}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
const enabled=process.env.RUN_REDESIGN_DB_TESTS==="1";
const url=process.env.DATABASE_URL;
if(enabled){const t=new URL(url!);if(t.hostname!=="127.0.0.1"||t.port!=="55432"||t.pathname!=="/fkh_redesign")throw new Error("Disposable DB required");}
let sql:ReturnType<typeof postgres>;
beforeAll(()=>{if(enabled)sql=postgres(url!,{max:1});});
afterAll(async()=>{if(enabled){await closeDb();await sql.end();}});
it.skipIf(!enabled)("validates, audits, rejects stale/linked scoring edits and rolls back failed audit",async()=>{
 actor.id=(await sql`insert into fkh_users(name) values('Synthetic template admin') returning id`)[0].id;
 const slug=`test-${crypto.randomUUID()}`;let templateId:string|undefined;let challengeId:string|undefined;
 const trigger=`template_test_${Date.now()}`;
 const input:AdminChallengeTemplateInput={slug,name:'Synthetic template',description:'Fixture only',challengeType:'consistency',scoringDirection:'asc',active:true,rulesJson:{minShots:5,metric:'carry_stddev',clubTypes:['7i']}};
 try{
  await expect(saveAdminChallengeTemplate(input)).rejects.toMatchObject({digest:expect.stringContaining('NEXT_REDIRECT')});
  await sql`insert into fkh_admin_users(user_id,role) values(${actor.id},'operator')`;
  await expect(saveAdminChallengeTemplate({...input,rulesJson:{minShots:-1}})).rejects.toThrow('Minimum shots');
  const saved=await saveAdminChallengeTemplate(input);templateId=saved.id;
  await expect(saveAdminChallengeTemplate({...input,id:saved.id,expectedUpdatedAt:'stale'})).rejects.toThrow('has changed');
  const concurrent = await Promise.allSettled([
    saveAdminChallengeTemplate({...input,id:saved.id,expectedUpdatedAt:saved.updatedAt.toISOString(),rulesJson:{minShots:6,metric:'carry_stddev'}}),
    saveAdminChallengeTemplate({...input,id:saved.id,expectedUpdatedAt:saved.updatedAt.toISOString(),rulesJson:{minShots:7,metric:'carry_stddev'}}),
  ]);
  expect(concurrent.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  expect(concurrent.filter(result=>result.status==='rejected')).toHaveLength(1);
  const success=concurrent.find(result=>result.status==='fulfilled');
  if(!success || success.status!=='fulfilled') throw new Error('Expected one edit');
  const edited=success.value;
  challengeId=(await sql`insert into fkh_challenges(template_id,creator_user_id,title,challenge_rules_json) values(${saved.id},${actor.id},'Synthetic referenced challenge',${sql.json(edited.rulesJson as Parameters<typeof sql.json>[0])}) returning id`)[0].id;
  const update={...input,id:saved.id,expectedUpdatedAt:edited.updatedAt.toISOString(),rulesJson:edited.rulesJson};
  await expect(saveAdminChallengeTemplate({...update,scoringDirection:'desc'})).rejects.toThrow('used by a challenge');
  await expect(saveAdminChallengeTemplate({...update,rulesJson:{minShots:99}})).rejects.toThrow('used by a challenge');
  const renamed=await saveAdminChallengeTemplate({...update,name:'Renamed fixture',active:false});
  expect(renamed.active).toBe(false);
  await expect(createChallenge({templateId:saved.id,title:'Must not create',visibility:'public'})).rejects.toThrow('template');
  expect(await sql`select id from fkh_challenges where template_id=${saved.id}`).toHaveLength(1);
  expect((await sql`select challenge_rules_json from fkh_challenges where id=${challengeId!}`)[0].challenge_rules_json).toEqual(edited.rulesJson);
  await sql.unsafe(`create function ${trigger}() returns trigger language plpgsql as $$ begin if NEW.actor_user_id='${actor.id}'::uuid then raise exception 'synthetic audit failure'; end if; return NEW; end $$`);
  await sql.unsafe(`create trigger ${trigger} before insert on fkh_admin_audit_log for each row execute function ${trigger}()`);
  await expect(saveAdminChallengeTemplate({...update,expectedUpdatedAt:renamed.updatedAt.toISOString(),name:'Must roll back'})).rejects.toThrow();
  expect((await sql`select name from fkh_challenge_templates where id=${saved.id}`)[0].name).toBe('Renamed fixture');
  expect(await sql`select id from fkh_admin_audit_log where actor_user_id=${actor.id}`).toHaveLength(3);
 }finally{
  await sql.unsafe(`drop function if exists ${trigger}() cascade`);
  if(challengeId)await sql`delete from fkh_challenges where id=${challengeId!}`;
  if(templateId)await sql`delete from fkh_challenge_templates where id=${templateId}`;
  await sql`delete from fkh_admin_audit_log where actor_user_id=${actor.id}`;
  await sql`delete from fkh_users where id=${actor.id}`;
 }
});
