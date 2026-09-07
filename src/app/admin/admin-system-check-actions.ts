"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { recordAdminSystemSnapshot } from "@/lib/admin-system-checks";
export async function runAdminSystemSnapshotAction(
  _previous?: { ok: boolean; error?: string; message?: string },
  _data?: FormData,
): Promise<{ ok: boolean; error?: string; message?: string; checkedAt?: string }> {
  void _previous;
  void _data;
  try {
    const result = await recordAdminSystemSnapshot();
    revalidatePath("/admin/system-checks");
    return {
      ok: true,
      checkedAt: result.checkedAt,
      message: `Stored operational records checked at ${result.checkedAt}. Live provider health was not checked.`,
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error:
        "The stored-record check could not be saved. Try again. Live provider health has not been checked.",
    };
  }
}
