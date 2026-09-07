import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({save:vi.fn(),user:vi.fn()}));
vi.mock("@/lib/current-user",()=>({requireCurrentUserId:mocks.user}));
vi.mock("@/db/client",()=>({getDb:()=>({update:()=>({set:()=>({where:mocks.save})})})}));
import { dismissWelcomeStateAction } from "./actions";
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('DATABASE_URL','synthetic');mocks.user.mockResolvedValue('synthetic-user');});
afterEach(()=>vi.unstubAllEnvs());
it('keeps failed persistence recoverable without leaking database errors',async()=>{
 mocks.save.mockRejectedValue(new Error('private connection detail'));
 expect(await dismissWelcomeStateAction({},new FormData())).toEqual({error:'Your choice could not be saved. Try again.'});
 expect(mocks.save).toHaveBeenCalledOnce();
});
it('preserves the successful Today redirect through the error boundary',async()=>{
 mocks.save.mockResolvedValue(undefined);
 await expect(dismissWelcomeStateAction({error:'old'},new FormData())).rejects.toMatchObject({digest:expect.stringContaining('/today')});
 expect(mocks.user).toHaveBeenCalledOnce();expect(mocks.save).toHaveBeenCalledOnce();
});
it('never writes if authentication fails',async()=>{
 mocks.user.mockRejectedValue(new Error('No current user'));
 expect(await dismissWelcomeStateAction({},new FormData())).toEqual({error:'Your choice could not be saved. Try again.'});
 expect(mocks.save).not.toHaveBeenCalled();
});
