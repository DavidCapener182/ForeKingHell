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
    try {
      revalidatePath("/admin/system-checks");
    } catch {
      /* Saved receipt remains valid if refresh fails. */
    }
    return {
      ok: true,
      checkedAt: result.checkedAt,
      message: `Checks saved at ${result.checkedAt}: ${result.liveChecks.filter((check) => check.state === "passed").length} read-only probes passed, ${result.liveChecks.filter((check) => check.state === "failed").length} failed, ${result.liveChecks.filter((check) => check.state === "unavailable").length} unavailable. Payments, AI and provider sync were not exercised.`,
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      error:
        "The check result could not be saved. Try again; no successful result has been confirmed.",
    };
  }
}
