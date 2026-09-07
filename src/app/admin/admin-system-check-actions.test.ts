import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({record:vi.fn(),refresh:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.refresh}));
vi.mock("next/navigation",()=>({unstable_rethrow:vi.fn()}));
vi.mock("@/lib/admin-system-checks",()=>({recordAdminSystemSnapshot:mocks.record}));
import {runAdminSystemSnapshotAction} from "./admin-system-check-actions";
beforeEach(()=>vi.resetAllMocks());
it("announces only a recorded check and its actual timestamp",async()=>{
 mocks.record.mockResolvedValue({checkedAt:"2026-09-07T12:00:00.000Z"});
 const result=await runAdminSystemSnapshotAction();
 expect(result.ok).toBe(true);expect(result.checkedAt).toBe("2026-09-07T12:00:00.000Z");
 expect(result.message).toContain("Live provider health was not checked");
 expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith("/admin/system-checks");
});
it("does not publish success or refresh when the record cannot be saved",async()=>{
 mocks.record.mockRejectedValue(new Error("private storage detail"));
 const result=await runAdminSystemSnapshotAction({ok:true,message:"old"},new FormData());
 expect(result.ok).toBe(false);expect(result.checkedAt).toBeUndefined();expect(result.message).toBeUndefined();
 expect(result.error).not.toContain("private storage detail");expect(mocks.refresh).not.toHaveBeenCalled();
});
