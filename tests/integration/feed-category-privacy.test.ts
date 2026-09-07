import { afterAll, expect, it, vi } from "vitest";
import postgres from "postgres";
import { closeDb } from "@/db/client";
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => actor.id, getOptionalCurrentUserId: async () => actor.id }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { ensureSocialProfileForUser, getVisibleFeedItemsForViewer, getPublicFeedItemsForProfile, getProfilePageData, addFeedReaction, addFeedComment, addFeedCommentReaction } from "@/lib/social";
const enabled = process.env.RUN_REDESIGN_DB_TESTS === "1";
const url = process.env.DATABASE_URL;
if (enabled) {
  const target = url ? new URL(url) : null;
  if (target?.hostname !== "127.0.0.1" || target.port !== "55432" || target.pathname !== "/fkh_redesign") throw new Error("Disposable database required");
}
afterAll(closeDb);
it.skipIf(!enabled)("category scopes constrain public items without widening private items or changing owner access", async () => {
  const db = postgres(url!, { max: 1 }); const users: string[] = [];
  try {
    users.push(...(await db`insert into fkh_users(name) values('Synthetic category owner'),('Synthetic category friend') returning id`).map(row=>row.id));
    for (const id of users) await ensureSocialProfileForUser(id);
    const [a,b]=[...users].sort(); await db`insert into fkh_friendships(user_a_id,user_b_id) values(${a},${b})`;
    const ids: string[]=[];
    for (const type of ['new_pb','longest_drive','achievement_unlock','level_up','round_completed','post_round_recap','practice_completed']) ids.push((await db`insert into fkh_feed_items(user_id,item_type,headline,visibility) values(${users[0]},${type},'Synthetic category evidence','public') returning id`)[0].id);
    const [status]=await db`insert into fkh_feed_items(user_id,item_type,headline,visibility) values(${users[0]},'status_update','Unmapped public status','public') returning id`;
    const [privateItem]=await db`insert into fkh_feed_items(user_id,item_type,headline,visibility) values(${users[0]},'new_pb','Private item','private') returning id`;
    const setScope=async(scope:string)=>{await db`update fkh_user_profiles set visibility_settings_json=${db.json({pbs:scope,achievements:scope,rounds:scope,practice:scope})} where user_id=${users[0]}`;};
    await setScope('private'); actor.id=users[1];
    expect((await getVisibleFeedItemsForViewer(actor.id,{ownerUserId:users[0]})).map(item=>item.id)).toEqual([status.id]);
    expect((await getPublicFeedItemsForProfile(users[0],20)).map(item=>item.id)).toEqual([status.id]);
    await expect(addFeedReaction(ids[0])).rejects.toThrow('Feed item not found');
    await expect(addFeedComment(ids[0], 'Forbidden comment')).rejects.toThrow('Feed item not found');
    const [comment]=await db`insert into fkh_feed_comments(feed_item_id,user_id,body) values(${ids[0]},${users[0]},'Owner comment') returning id`;
    await expect(addFeedCommentReaction(comment.id)).rejects.toThrow('Comment not found');

    expect(await db`select id from fkh_feed_reactions where user_id=${users[1]}`).toHaveLength(0);
    expect(await getVisibleFeedItemsForViewer(users[0],{ownerUserId:users[0]})).toHaveLength(9);
    await setScope('friends');
    expect(await getVisibleFeedItemsForViewer(users[1],{ownerUserId:users[0]})).toHaveLength(8);
    expect((await getPublicFeedItemsForProfile(users[0],20)).map(item=>item.id)).toEqual([status.id]);
    await setScope('public');
    const visible=await getPublicFeedItemsForProfile(users[0],20);
    expect(visible).toHaveLength(8); expect(visible.map(item=>item.id)).not.toContain(privateItem.id);
    await addFeedReaction(ids[0]);
    expect(await db`select id from fkh_feed_reactions where user_id=${users[1]} and feed_item_id=${ids[0]}`).toHaveLength(1);
  } finally {
    if(users.length) await db`delete from fkh_users where id in ${db(users)}`;
    await db.end();
  }
});

it.skipIf(!enabled)("profile returns only the pending request for the viewed pair", async () => {
  const db = postgres(url!, {max:1}); const users:string[]=[];
  try {
    users.push(...(await db`insert into fkh_users(name) values('Synthetic request viewer'),('Synthetic request subject'),('Synthetic unrelated subject') returning id`).map(row=>row.id));
    const profiles=[];
    for(const id of users) profiles.push(await ensureSocialProfileForUser(id));
    await db`update fkh_user_profiles set public_profile=true where user_id in ${db(users)}`;
    actor.id=users[0];
    await db`insert into fkh_friend_requests(requester_user_id,recipient_user_id,status) values(${users[0]},${users[2]},'pending')`;
    expect((await getProfilePageData(profiles[1].username))?.pendingRequestId).toBeNull();
    const [request]=await db`insert into fkh_friend_requests(requester_user_id,recipient_user_id,status) values(${users[0]},${users[1]},'pending') returning id`;
    expect(await getProfilePageData(profiles[1].username)).toMatchObject({pendingRequestId:request.id,profile:{relationship:'outgoing'}});
    actor.id=users[1];
    expect(await getProfilePageData(profiles[0].username)).toMatchObject({pendingRequestId:request.id,profile:{relationship:'incoming'}});
    await db`update fkh_friend_requests set status='cancelled' where id=${request.id}`;
    expect((await getProfilePageData(profiles[0].username))?.pendingRequestId).toBeNull();
  } finally {
    if(users.length) await db`delete from fkh_users where id in ${db(users)}`;
    await db.end();
  }
});
