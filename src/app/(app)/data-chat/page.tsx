import { LockedDataChatPanel } from "@/app/data-chat/locked-data-chat-panel";

import { DataChatPanel } from "@/app/data-chat/data-chat-panel";
import { PageShell } from "@/components/premium";
import { getAiFeatureEntitlement } from "@/lib/ai/usage";
import { planAllowsAiFeature } from "@/lib/ai/features";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type DataChatPageProps = {
  searchParams?: Promise<{
    prompt?: string | string[];
  }>;
};

export default async function DataChatPage({ searchParams }: DataChatPageProps) {
  const params = await searchParams;
  const initialPrompt = normalizePrompt(params?.prompt);
  const userId = await requireCurrentUserId();
  const entitlement = await getAiFeatureEntitlement(userId, "data_chat");
  const canUseDataChat = planAllowsAiFeature(entitlement.planKey, "data_chat");

  return (
    <PageShell className="lg:py-4" contentClassName="lg:gap-0">
      <div className="min-w-0" data-workbench-scope="data-chat">
        <section data-data-chat-panel="responsive" aria-labelledby="data-chat-heading">
          {canUseDataChat ? (
            <DataChatPanel
              key={userId}
              accountId={userId}
              monthlyRemaining={entitlement.monthlyRemaining}
              questionId="data-chat-question"
              initialQuestion={initialPrompt}
            />
          ) : (
            <LockedDataChatPanel />
          )}
        </section>
      </div>
    </PageShell>
  );
}

function normalizePrompt(prompt: string | string[] | undefined) {
  const rawPrompt = Array.isArray(prompt) ? prompt[0] : prompt;

  if (!rawPrompt) {
    return "";
  }

  return rawPrompt.trim().replace(/\s+/g, " ").slice(0, 800);
}
