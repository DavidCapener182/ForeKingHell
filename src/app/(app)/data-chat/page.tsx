import Link from "next/link";
import {
  Brain,
  CreditCard,
  Database,
  FileText,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { DataChatPanel } from "@/app/data-chat/data-chat-panel";
import { AiDesktopWorkbench } from "@/components/app/ai-desktop-workbench";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import {
  DesktopInsightRail,
  DesktopWorkbenchLayout,
  commonAiPrompts,
} from "@/components/app/desktop-workbench";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
      <DesktopWorkbenchLayout scope="data-chat">
        <AiDesktopWorkbench
          defaultTab="ask"
          diagnosis={
            <>
              <PageHeader
                eyebrow={
                  <StatusPill tone={canUseDataChat ? "green" : "amber"}>AI assistant</StatusPill>
                }
                title="Data Chat"
                description="Ask from your LM World Tour activity, bag, rounds, speed work, practice plans and achievements."
                visual={
                  <PageArtwork variant="dataChat" alt="" className="h-full min-h-36" priority />
                }
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
              />
              <Alert className="border-primary/20 bg-primary/5 p-4">
                <ShieldCheck className="size-4" aria-hidden />
                <AlertTitle>Read-only golf advice</AlertTitle>
                <AlertDescription>
                  Answers can cite your records, but cannot change yardages, handicap, billing or
                  saved evidence.
                </AlertDescription>
              </Alert>
            </>
          }
          evidence={
            <>
              <ConnectedMetricBar
                label="Data Chat evidence and access"
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
                  { label: "Per answer", value: "1 credit", detail: "Logged to monthly usage" },
                  { label: "Data mode", value: "Read-only", detail: "Advice and drills only" },
                ]}
              />
              <Alert className="p-4">
                <Database className="size-4" aria-hidden />
                <AlertTitle>Evidence scope</AlertTitle>
                <AlertDescription>
                  Saved shots, rounds, bag, speed and practice records are available. Each answer
                  must return linked citations and disclose gaps.
                </AlertDescription>
              </Alert>
            </>
          }
          ask={
            <section data-data-chat-panel="desktop" aria-labelledby="desktop-data-chat-heading">
              <div className="mb-4">
                <h2 id="desktop-data-chat-heading" className="text-xl font-semibold">
                  Ask LM World Tour
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Answers use saved golf data and link back to cited app records.
                </p>
              </div>
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
          }
          context={
            <DesktopInsightRail
              title="AI data context"
              description="Cited explanations, comparisons, saved answers and practice-plan drafts."
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
                  detail: `${entitlement.monthlyLimit.toLocaleString("en-GB")} monthly credits.`,
                },
                {
                  label: "Write access",
                  value: "None",
                  detail: "Answers cannot change golf or billing records.",
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
        />
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
