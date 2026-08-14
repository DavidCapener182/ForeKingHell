import Link from "next/link";
import { CreditCard, ShieldCheck, Sparkles } from "lucide-react";

import { DataChatPanel } from "@/app/data-chat/data-chat-panel";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
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
      <DesktopWorkbenchLayout scope="data-chat">
        <section data-data-chat-panel="desktop" aria-labelledby="data-chat-heading">
          {canUseDataChat ? (
            <DataChatPanel
              monthlyRemaining={entitlement.monthlyRemaining}
              questionId="desktop-data-chat-question"
              initialQuestion={initialPrompt}
            />
          ) : (
            <LockedDataChatPanel />
          )}
        </section>
      </DesktopWorkbenchLayout>
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

function LockedDataChatPanel() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div>
          <h1 id="data-chat-heading" className="text-xl font-semibold tracking-tight">
            Data Chat
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            Pro access required
          </p>
        </div>
      </header>
      <div className="grid min-h-[34rem] place-items-center px-5 py-12">
        <div className="max-w-md text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            Analyse your game in conversation
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Data Chat uses your saved shots, rounds, bag and practice records to answer with cited
            evidence and a clear next action.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/billing" prefetch={false}>
              <CreditCard className="size-4" />
              View plans
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
