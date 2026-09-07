import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), oauth: vi.fn(), clear: vi.fn() }));
vi.mock("@/lib/current-user",()=>({ensureUserProfile:vi.fn()}));
vi.mock("@/lib/site-origin",()=>({getSiteOrigin:()=>"http://localhost"}));
vi.mock("@/lib/supabase/server",()=>({isSupabaseAuthConfigured:mocks.configured,clearSupabaseAuthCookies:mocks.clear,createSupabaseServerClient:async()=>({auth:{signInWithOAuth:mocks.oauth}})}));
import { signInWithOAuthAction, signInWithPasswordAction, sendMagicLinkAction } from "./actions";
beforeEach(()=>{vi.resetAllMocks();mocks.configured.mockReturnValue(true);mocks.oauth.mockResolvedValue({data:{url:null},error:{message:"Provider unavailable"}});});
it.each(['configuration','provider','exchange'])("retains safe destination after %s failure",async(mode)=>{
 if(mode==='configuration')mocks.configured.mockReturnValue(false);
 const data=new FormData();data.set('provider',mode==='provider'?'unsupported':'google');data.set('next','/billing?plan=plus');
 let error:unknown;try{await signInWithOAuthAction(data);}catch(caught){error=caught;}
 const digest=(error as {digest:string}).digest;
 const destination=new URL(digest.split(';')[2],'http://localhost');
 expect(destination.pathname).toBe('/login');expect(destination.searchParams.get('next')).toBe('/billing?plan=plus');
 if(mode!=='exchange')expect(mocks.oauth).not.toHaveBeenCalled();
});
it('rejects an external destination on provider failure',async()=>{
 const data=new FormData();data.set('provider','google');data.set('next','//example.invalid');
 let error:unknown;try{await signInWithOAuthAction(data);}catch(caught){error=caught;}
 const destination=new URL((error as {digest:string}).digest.split(';')[2],'http://localhost');
 expect(destination.searchParams.get('next')).toBeNull();
 expect(mocks.oauth).toHaveBeenCalledWith({provider:'google',options:{redirectTo:'http://localhost/auth/callback?next=%2Fdashboard'}});
});

it('returns a user-facing unavailable message without configuration details',async()=>{
 mocks.configured.mockReturnValue(false);
 for(const action of [signInWithPasswordAction,sendMagicLinkAction]) {
  expect(await action({status:'idle',message:null},new FormData())).toEqual({status:'error',message:'Sign-in is temporarily unavailable. Try again later.'});
 }
 expect(mocks.clear).not.toHaveBeenCalled();expect(mocks.oauth).not.toHaveBeenCalled();
});
