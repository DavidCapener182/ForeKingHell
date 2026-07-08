import Link from "next/link";
import {
  Brain,
  CreditCard,
  Database,
  FileText,
  Lightbulb,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { DataChatPanel } from "@/app/data-chat/data-chat-panel";
import {
  DesktopInsightRail,
  DesktopWorkbenchLayout,
  commonAiPrompts,
} from "@/components/app/desktop-workbench";
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
import { PageArtwork } from "@/components/visuals/page-artwork";
import { getAiFeatureEntitlement } from "@/lib/ai/usage";
import { planAllowsAiFeature } from "@/lib/ai/features";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type DataChatPageProps = {
  searchParams?: Promise<{
    prompt?: string | string[];
  }>;
};

const dataChatPrompts = [
  {
    label: "Explain my data",
    prompt:
      "Explain what my current ForeKingHell data can and cannot prove. Cite available records and call out low-confidence areas.",
    icon: Lightbulb,
  },
  {
    label: "Build practice plan",
    prompt:
      "Build a practice plan from my current ForeKingHell data. Prioritise the club or scoring area with the strongest evidence.",
    icon: Target,
  },
  {
    label: "Generate report",
    prompt:
      "Generate a performance report with this week's summary, strongest improvement, biggest weakness, confidence, and next practice action.",
    icon: FileText,
  },
  ...commonAiPrompts("data chat"),
];

export default async function DataChatPage({ searchParams }: DataChatPageProps) {
  const params = await searchParams;
  const initialPrompt = normalizePrompt(params?.prompt);
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
          <div data-data-chat-panel="mobile">
            <DataChatPanel
              monthlyRemaining={entitlement.monthlyRemaining}
              questionId="mobile-data-chat-question"
              initialQuestion={initialPrompt}
            />
          </div>
        ) : (
          <LockedDataChatPanel />
        )}
      </MobileAppShell>

      <DesktopWorkbenchLayout
        scope="data-chat"
        className="hidden sm:grid"
        rail={
          <DesktopInsightRail
            title="AI data rail"
            description="Use the assistant for cited explanations, comparisons, saved answers and practice-plan drafts."
            metrics={[
              {
                label: "Access",
                value: canUseDataChat ? "Live" : "Locked",
                detail: canUseDataChat
                  ? "Data Chat can answer from your records."
                  : "Upgrade before asking.",
                tone: canUseDataChat ? "green" : "amber",
              },
              {
                label: "Credits",
                value: entitlement.monthlyRemaining.toLocaleString("en-GB"),
                detail: `${entitlement.monthlyLimit.toLocaleString("en-GB")} monthly credits available.`,
              },
              {
                label: "Write access",
                value: "None",
                detail: "Answers and drills cannot change handicap, yardages, billing or records.",
              },
            ]}
            evidence={[
              "Saved shots, rounds, bag and practice records",
              "Linked citations returned with each answer",
              "Visible prompt text before any AI request is sent",
            ]}
            prompts={dataChatPrompts.slice(0, 5)}
            actions={[
              {
                label: "Coach desk",
                href: "/coach",
                detail: "Turn findings into drills and progress tracking.",
                icon: Brain,
              },
              {
                label: "Shot explorer",
                href: "/shots",
                detail: "Inspect the records behind an answer.",
                icon: Database,
              },
            ]}
          />
        }
      >
        <PageHeader
          eyebrow={<StatusPill tone={canUseDataChat ? "green" : "amber"}>AI assistant</StatusPill>}
          title="Data Chat"
          description="Ask from your ForeKingHell activity, bag, rounds, speed work, practice plans and achievements."
          visual={<PageArtwork variant="dataChat" alt="" className="h-full min-h-36" priority />}
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
          <CardContent className="p-5" data-data-chat-panel="desktop">
            {canUseDataChat ? (
              <DataChatPanel
                monthlyRemaining={entitlement.monthlyRemaining}
                questionId="desktop-data-chat-question"
                initialQuestion={initialPrompt}
                savedAnswerWorkbench
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
