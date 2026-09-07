import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({update:vi.fn(),redirect:vi.fn()}));
vi.mock("@/lib/current-user",()=>({requireCurrentUserId:async()=>"synthetic-user"}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/product-preferences",async(importOriginal)=>({...await importOriginal<typeof import("@/lib/product-preferences")>(),updateProductPreferences:mocks.update}));
import {saveNotificationPreferencesAction,saveNotificationPreferencesFormAction} from "./actions";
import {notificationCategories} from "@/lib/product-preferences";
beforeEach(()=>vi.resetAllMocks());
it("preserves all delivery and legacy fields through the same parser",async()=>{
 const data=new FormData();for(const category of notificationCategories)data.set(category,'weekly');
 data.set('legacy_social','on');data.set('legacy_dataQuality','on');data.set('legacy_weeklyReview','on');
 await saveNotificationPreferencesAction(data);const legacy=mocks.update.mock.calls[0];mocks.redirect.mockClear();
 expect(await saveNotificationPreferencesFormAction({ok:false,error:'Old'},data)).toEqual({ok:true});expect(mocks.update.mock.calls[1]).toEqual(legacy);
 expect(legacy[1].notifications).toEqual({social:true,challenges:false,dataQuality:true,achievements:false,weeklyReview:true,delivery:Object.fromEntries(notificationCategories.map(category=>[category,'weekly']))});
 expect(mocks.redirect).not.toHaveBeenCalled();
});
it("retains pending state until persistence rejects without claiming success",async()=>{
 let reject!:(error:Error)=>void;mocks.update.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));
 let settled=false;const result=saveNotificationPreferencesFormAction({ok:true},new FormData()).then(value=>{settled=true;return value;});
 await vi.waitFor(()=>expect(mocks.update).toHaveBeenCalled());expect(settled).toBe(false);reject(new Error('Write failed'));expect(await result).toEqual({ok:false,error:'Write failed'});
});
