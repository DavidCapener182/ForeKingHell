import Link from "next/link";
import { Brain, CreditCard, Database, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

import { DataChatPanel } from "@/app/data-chat/data-chat-panel";
import { DataPanel, PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import {
  MobileAppShell,
  MobileRouteTabs,
  MobileTopBar,
  PBCard,
  ProgressCard,
} from "@/components/mobile-sports";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { getAiFeatureEntitlement } from "@/lib/ai/usage";
import { planAllowsAiFeature } from "@/lib/ai/features";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function DataChatPage() {
  const userId = await requireCurrentUserId();
  const entitlement = await getAiFeatureEntitlement(userId, "data_chat");
  const canUseDataChat = planAllowsAiFeature(entitlement.planKey, "data_chat");

  return (
    <PageShell>
      <MobileAppShell>
        <MobileTopBar title="Improve" />
        <MobileRouteTabs group="improve" activeKey="data-chat" />
        <section className="premium-hero grid gap-3 rounded-lg p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <StatusPill tone={canUseDataChat ? "green" : "amber"}>
                {canUseDataChat ? "Available" : "Pro"}
              </StatusPill>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal">Data Chat</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Ask about your ForeKingHell activity, bag, rounds and practice history.
              </p>
            </div>
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
              <MessageCircle className="size-5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PBCard
              title="Credits"
              value={entitlement.monthlyRemaining.toLocaleString("en-GB")}
              detail={`${entitlement.monthlyLimit.toLocaleString("en-GB")} monthly`}
            />
            <PBCard title="Scope" value="Your data" detail="Read-only" />
          </div>
        </section>
        {canUseDataChat ? (
          <DataChatPanel
            monthlyRemaining={entitlement.monthlyRemaining}
            questionId="mobile-data-chat-question"
          />
        ) : (
          <LockedDataChatPanel />
        )}
      </MobileAppShell>

      <div className="hidden gap-5 sm:grid">
        <PageHeader
          eyebrow={<StatusPill tone={canUseDataChat ? "green" : "amber"}>AI assistant</StatusPill>}
          title="Data Chat"
          description="Ask from your ForeKingHell activity, bag, rounds, speed work, practice plans and achievements."
          actions={
            canUseDataChat ? (
              <Button asChild variant="outline">
                <Link href="/coach" prefetch={false}>
                  <Brain className="size-4" />
                  Coach
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/billing" prefetch={false}>
                  <CreditCard className="size-4" />
                  Upgrade
                </Link>
              </Button>
            )
          }
          metrics={[
            {
              label: "Access",
              value: canUseDataChat ? "Available" : "Pro+",
              detail: canUseDataChat ? "Included in your plan" : "Paid AI feature",
            },
            {
              label: "Credits left",
              value: entitlement.monthlyRemaining.toLocaleString("en-GB"),
              detail: `${entitlement.monthlyLimit.toLocaleString("en-GB")} monthly credits`,
            },
            {
              label: "Per answer",
              value: "1 credit",
              detail: "Logged against monthly AI usage",
            },
            {
              label: "Data mode",
              value: "Read-only",
              detail: "Advice and drills only",
            },
          ]}
        />

        <DataPanel>
          <SectionHeader
            title="Ask ForeKingHell"
            description="Answers are grounded in your saved golf data and linked back to cited app records."
            action={<Database className="size-5 text-emerald-700" />}
          />
          <CardContent className="p-5">
            {canUseDataChat ? (
              <DataChatPanel
                monthlyRemaining={entitlement.monthlyRemaining}
                questionId="desktop-data-chat-question"
              />
            ) : (
              <LockedDataChatPanel />
            )}
          </CardContent>
        </DataPanel>

        <section className="grid gap-4 xl:grid-cols-3">
          <ProgressCard
            title="Context"
            value="Bag, rounds, shots"
            detail="Also includes speed, practice, challenge and achievement signals."
          />
          <ProgressCard
            title="Safeguard"
            value="No write-back"
            detail="The assistant cannot save yardages, records, handicap or billing changes."
          />
          <ProgressCard
            title="Useful asks"
            value="Tips and drills"
            detail="Best for priorities, weak clubs, round prep and practice plans."
          />
        </section>
      </div>
    </PageShell>
  );
}

function LockedDataChatPanel() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-amber-700 ring-1 ring-amber-200">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-amber-950">Data Chat is a Pro AI feature</p>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              Paid plans include monthly AI credits. ForeKing Hell full access remains available.
            </p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/billing" prefetch={false}>
            <Sparkles className="size-4" />
            View plans
          </Link>
        </Button>
      </div>
    </div>
  );
}
