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
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
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
      "Explain what my current LM World Tour data can and cannot prove. Cite available records and call out low-confidence areas.",
    icon: Lightbulb,
  },
  {
    label: "Build practice plan",
    prompt:
      "Build a practice plan from my current LM World Tour data. Prioritise the club or scoring area with the strongest evidence.",
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
      <MobileAppShell className="gap-4">
        <MobileTopBar title="Data Chat" />
        <MobileRouteTabs group="improve" activeKey="data-chat" />
        <section className="grid gap-3" aria-labelledby="data-chat-mobile-status">
          <IOSSectionHeader
            title={<span id="data-chat-mobile-status">Your golf assistant</span>}
            description="Ask a question first; supporting tips, drills and citations stay available on demand."
          />
          <IOSGroupedList label="Data Chat access and scope">
            <IOSListRow
              label="Data Chat"
              value={canUseDataChat ? "Available" : "Pro"}
              detail="Rounds, shots, bag, speed and practice evidence"
              icon={MessageCircle}
              status={
                <IOSInlineStatus
                  label={canUseDataChat ? "Ready to answer" : "Upgrade required"}
                  tone={canUseDataChat ? "positive" : "attention"}
                />
              }
            />
            <IOSMetricRow
              label="Credits remaining"
              value={entitlement.monthlyRemaining.toLocaleString("en-GB")}
              detail={`${entitlement.monthlyLimit.toLocaleString("en-GB")} monthly · 1 per answer`}
            />
            <IOSListRow
              label="Read-only scope"
              value="Your data"
              detail="Advice cannot change yardages, records, handicap or billing."
              icon={ShieldCheck}
            />
          </IOSGroupedList>
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
        className="hidden lg:grid"
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
          description="Ask from your LM World Tour activity, bag, rounds, speed work, practice plans and achievements."
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
            title="Ask LM World Tour"
            description="Answers are grounded in your saved golf data and linked back to cited app records."
            action={<Database className="size-5 text-primary" />}
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
    <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] p-4 text-[var(--status-warning-foreground)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-card text-[var(--status-warning-foreground)] ring-1 ring-[var(--status-warning-border)]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Data Chat is a Pro AI feature</p>
            <p className="mt-1 text-sm leading-6 opacity-85">
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
