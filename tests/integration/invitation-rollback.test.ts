import {afterAll,expect,it,vi} from "vitest";
import postgres from "postgres";
import {closeDb} from "@/db/client";
const actor=vi.hoisted(()=>({id:"",email:""}));
vi.mock("@/lib/current-user",()=>({getCurrentUser:async()=>actor,requireCurrentUserId:async()=>actor.id}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {acceptInvitationAction,acceptInvitationFormAction} from "@/app/settings/actions";
import {createInvitationToken,hashInvitationToken} from "@/lib/collaboration";
const enabled=process.env.RUN_REDESIGN_DB_TESTS==="1";
const url=process.env.DATABASE_URL;
if(enabled){const target=url?new URL(url):null;if(target?.hostname!=="127.0.0.1"||target.port!=="55432"||target.pathname!=="/fkh_redesign")throw new Error("Disposable database required");}
afterAll(closeDb);
it.skipIf(!enabled)("membership failure rolls back invitation claim and permits a later retry",async()=>{
 const db=postgres(url!,{max:1});const users:string[]=[];const marker=`invitation_failure_${crypto.randomUUID().replaceAll('-','')}`;
 try{
 users.push(...(await db`insert into fkh_users(name,email) values('Synthetic invite owner','rollback-owner@example.invalid'),('Synthetic invite recipient','rollback-recipient@example.invalid') returning id`).map(row=>row.id));
 actor.id=users[1];actor.email='rollback-recipient@example.invalid';const token=createInvitationToken();
 const [invite]=await db`insert into fkh_account_invitations(owner_user_id,invited_email,role,token_hash,status,expires_at) values(${users[0]},${actor.email},'viewer',${hashInvitationToken(token)},'pending',now()+interval '1 day') returning id`;
 await db.unsafe(`create function ${marker}() returns trigger language plpgsql as $$ begin if NEW.owner_user_id = '${users[0]}'::uuid then raise exception 'Synthetic membership save failure'; end if; return NEW; end $$`);
 await db.unsafe(`create trigger ${marker} before insert on fkh_account_memberships for each row execute function ${marker}()`);
 const data=new FormData();data.set('token',token);
 expect((await acceptInvitationFormAction({ok:true},data)).ok).toBe(false);
 expect((await db`select status,accepted_by_user_id,accepted_at from fkh_account_invitations where id=${invite.id}`)[0]).toEqual({status:'pending',accepted_by_user_id:null,accepted_at:null});
 expect(await db`select id from fkh_account_memberships where owner_user_id=${users[0]}`).toHaveLength(0);
 await db.unsafe(`drop trigger ${marker} on fkh_account_memberships`);
 await expect(acceptInvitationAction(data)).rejects.toMatchObject({digest:expect.stringContaining('inviteAccepted=1')});
 expect(await db`select role from fkh_account_memberships where owner_user_id=${users[0]} and member_user_id=${users[1]}`).toEqual([{role:'viewer'}]);
 }finally{
 await db.unsafe(`drop trigger if exists ${marker} on fkh_account_memberships`);
 await db.unsafe(`drop function if exists ${marker}()`);
 if(users.length)await db`delete from fkh_users where id in ${db(users)}`;
 await db.end();
 }
});
