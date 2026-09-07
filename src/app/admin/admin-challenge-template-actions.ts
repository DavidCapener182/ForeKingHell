"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { saveAdminChallengeTemplate, TemplateValidationError } from "@/lib/admin-challenge-templates";
export async function saveAdminChallengeTemplateAction(_previous: {ok:boolean;error?:string;message?:string}, data: FormData): Promise<{ok:boolean;error?:string;message?:string}> {
  const text = (key:string) => String(data.get(key) ?? "").trim();
  try {
    let rulesJson: Record<string,unknown>;
    try { rulesJson=JSON.parse(text("rulesJson") || "{}"); } catch { return {ok:false,error:"Enter valid JSON for the rules."}; }
    await saveAdminChallengeTemplate({id:text("id")||undefined,expectedUpdatedAt:text("expectedUpdatedAt")||undefined,slug:text("slug"),name:text("name"),description:text("description"),challengeType:text("challengeType"),scoringDirection:text("scoringDirection"),active:data.get("active")==="on"||data.get("active")==="true",rulesJson});
    revalidatePath("/admin/challenges");revalidatePath("/challenges");
    return {ok:true,message:text("id")?"Template updated.":"Template created."};
  } catch(error) {
    unstable_rethrow(error);
    return {ok:false,error:error instanceof TemplateValidationError?error.message:"The template could not be saved. Try again."};
  }
}
