import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ update: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/social", () => ({ updateCurrentSocialProfile: mocks.update, defaultProfileVisibilitySettings: () => ({}), parseVisibility: (value: unknown, fallback: string) => ["private", "friends", "public"].includes(String(value)) ? value : fallback }));
import { updateSocialProfileAction, updateSocialProfileFormAction } from "./actions";
const form = (values: Record<string,string>) => { const data = new FormData(); Object.entries(values).forEach(([key,value]) => data.set(key,value)); return data; };
beforeEach(() => vi.resetAllMocks());
it("preserves all legacy profile media and privacy fields without redirecting", async () => {
  const data = form({ username:" golfer ", displayName:" Golfer ",avatarUrl:"data:image/png;base64,YQ==",headerImageUrl:"https://example.com/header.png",bio:" Bio ",homeCourse:" Home ",primaryLaunchMonitor:" Monitor ",publicProfile:"on",friendProfile:"on",feedVisibilityDefault:"friends",leaderboardVisibility:"private",roundsVisibility:"private",pbsVisibility:"public",bagVisibility:"friends",achievementsVisibility:"private",handicapVisibility:"friends",practiceVisibility:"public",exactShotsVisibility:"private",allowCompare:"on" });
  await updateSocialProfileAction(data); const expected = mocks.update.mock.calls[0][0]; mocks.redirect.mockClear();
  expect(await updateSocialProfileFormAction({ok:false,error:"Old error"},data)).toEqual({ok:true});
  expect(mocks.update.mock.calls[1][0]).toEqual(expected);
  expect(expected).toMatchObject({username:"golfer",displayName:"Golfer",avatarUrl:"data:image/png;base64,YQ==",headerImageUrl:"https://example.com/header.png",visibilitySettingsJson:{rounds:"private",pbs:"public",bag:"friends",achievements:"private",handicap:"friends",practice:"public",exactShots:"private",allowCompare:true}});
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it("does not confirm success before persistence and returns save errors", async () => {
  let reject!: (error: Error) => void; mocks.update.mockImplementation(() => new Promise((_,r) => {reject=r;}));
  let settled=false; const result=updateSocialProfileFormAction({ok:true},form({})).then(value=>{settled=true;return value;});
  await Promise.resolve(); expect(settled).toBe(false); reject(new Error("Username unavailable"));
  expect(await result).toEqual({ok:false,error:"Username unavailable"});
});
it.each(["javascript:alert(1)","x".repeat(700001)])("rejects invalid media before saving (%#)",async avatarUrl=>{
  expect((await updateSocialProfileFormAction({ok:true},form({avatarUrl}))).ok).toBe(false);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("preserves empty optional fields and unchecked private defaults",async()=>{
  await updateSocialProfileFormAction({ok:false},form({bio:"  ",avatarUrl:" "}));
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({bio:null,avatarUrl:null,headerImageUrl:null,publicProfile:false,friendProfile:false,feedVisibilityDefault:"private",leaderboardVisibility:"private"}));
});
