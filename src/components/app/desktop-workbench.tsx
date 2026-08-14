import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  FileText,
  Lightbulb,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

import {
  DesktopWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench-controls";
import { DesktopSaveInsightButton } from "@/components/app/desktop-save-insight-button";
import { OperationStepper } from "@/components/app/operation-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { DataPanel, SectionHeader, StatusPill, type Tone } from "@/components/premium";
import { cn } from "@/lib/utils";

export type DesktopInsightMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
};

export type DesktopAiPrompt = {
  label: string;
  prompt: string;
  icon?: LucideIcon;
};

export type DesktopWorkbenchAction = {
  label: string;
  href: string;
  detail: string;
  icon?: LucideIcon;
};

export type DesktopWorkflowStep = {
  title: string;
  detail: string;
  status?: "complete" | "current" | "upcoming";
  value?: string;
};

export type DesktopWorkflowHelpItem = {
  title: string;
  detail: string;
};

type DesktopRailBreakpoint = "xl" | "2xl" | "wide";

export type { DesktopSavedViewSuggestion, DesktopWorkbenchColumn };

const desktopInsightRailScopes = new Set([
  "admin",
  "bag",
  "club-analytics",
  "coach",
  "compare",
  "course-records",
  "courses",
  "data-chat",
  "progress",
  "round-detail",
  "rounds",
  "shots",
  "strokes-gained",
  "today",
]);

export function DesktopWorkbenchLayout({
  children,
  rail,
  scope,
  className,
  railBreakpoint = "wide",
}: {
  children: ReactNode;
  rail?: ReactNode;
  scope: string;
  className?: string;
  railBreakpoint?: DesktopRailBreakpoint;
}) {
  const railContent = rail && desktopInsightRailScopes.has(scope) ? rail : null;
  const railLayoutClass =
    railContent && railBreakpoint === "wide"
      ? "min-[2200px]:grid-cols-[minmax(0,1fr)_22rem] min-[2200px]:items-start"
      : railContent && railBreakpoint === "2xl"
        ? "2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:items-start"
        : railContent
          ? "xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start"
          : "";

  return (
    <div
      data-workbench-scope={scope}
      className={cn("grid min-w-0 gap-5", railLayoutClass, className)}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 overflow-hidden">{children}</div>
      {railContent ? (
        <div
          className={cn(
            "min-w-0",
            railBreakpoint === "wide"
              ? "hidden min-[2200px]:block"
              : railBreakpoint === "2xl"
                ? "hidden 2xl:block"
                : "",
          )}
        >
          {railContent}
        </div>
      ) : null}
    </div>
  );
}

export function DesktopWorkflowLayout({
  children,
  steps,
  helpTitle,
  helpDescription,
  helpItems,
  workflowRailBreakpoint = "lg",
  className,
}: {
  children: ReactNode;
  steps: DesktopWorkflowStep[];
  helpTitle: string;
  helpDescription: string;
  helpItems: DesktopWorkflowHelpItem[];
  workflowRailBreakpoint?: "lg" | "2xl";
  className?: string;
}) {
  return (
    <section data-desktop-workflow className={cn("grid min-w-0 gap-4", className)}>
      <OperationStepper
        label="Desktop workflow"
        className="hidden lg:grid"
        steps={steps.map((step, index) => ({
          id: `${index + 1}-${step.title}`,
          label: step.title,
          description: step.value ? `${step.value}. ${step.detail}` : step.detail,
          status: step.status ?? "upcoming",
        }))}
      />

      <div
        className={cn(
          "grid min-w-0 gap-4",
          workflowRailBreakpoint === "2xl"
            ? "2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:items-start"
            : "xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start",
        )}
      >
        <div className="grid min-w-0 gap-4 [&>*]:min-w-0">{children}</div>

        <aside
          className={cn(
            "hidden min-w-0",
            workflowRailBreakpoint === "2xl" ? "2xl:grid" : "xl:grid",
          )}
        >
          <DataPanel className="sticky top-[4.75rem] gap-0 py-0">
            <SectionHeader title={helpTitle} description={helpDescription} />
            <CardContent className="grid gap-2 p-3">
              {helpItems.map((item) => (
                <div key={item.title} className="border-b border-border px-1 py-3 last:border-b-0">
                  <p className="text-sm font-semibold leading-5 text-foreground">{item.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </DataPanel>
        </aside>
      </div>
    </section>
  );
}

export function DesktopWorkbenchHeader({
  eyebrow,
  title,
  description,
  metrics,
  controls,
  actions,
  className,
}: {
  eyebrow: ReactNode;
  title: string;
  description: string;
  metrics?: DesktopInsightMetric[];
  controls?: ReactNode;
  actions?: DesktopWorkbenchAction[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "premium-hero hidden min-w-0 gap-4 overflow-hidden rounded-lg p-5 sm:grid lg:p-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-4xl">
          {eyebrow}
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-balance text-foreground xl:text-5xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">{description}</p>
        </div>
        {actions?.length ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions.map((action) => {
              const Icon = action.icon ?? ArrowRight;

              return (
                <Button key={`${action.label}-${action.href}`} asChild variant="outline">
                  <Link href={action.href} prefetch={false}>
                    <Icon className="size-4" />
                    {action.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        ) : null}
      </div>
      {metrics?.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="metric-tile rounded-lg border border-primary/10 bg-card/72 p-3"
            >
              <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
              <p
                data-operational-value
                className="mt-1 truncate text-2xl font-semibold tracking-normal text-foreground"
              >
                {metric.value}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {metric.detail}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {controls}
    </section>
  );
}

export function DesktopTableWorkbenchControls(props: {
  viewKey: string;
  scope: string;
  currentViewLabel: string;
  resultLabel: string;
  columns: DesktopWorkbenchColumn[];
  suggestedViews?: DesktopSavedViewSuggestion[];
  exportTableId?: string;
  exportFileName?: string;
  className?: string;
}) {
  return <DesktopWorkbenchControls {...props} />;
}

export function DesktopInsightRail({
  title,
  description,
  metrics,
  evidence,
  prompts,
  actions,
  className,
}: {
  title: string;
  description: string;
  metrics?: DesktopInsightMetric[];
  evidence?: string[];
  prompts?: DesktopAiPrompt[];
  actions?: DesktopWorkbenchAction[];
  className?: string;
}) {
  const railPrompts = prompts ?? [];
  const savePrompt = railPrompts.find((prompt) => prompt.label === "Save this insight");
  const reportPrompts = railPrompts.filter(
    (prompt) => prompt.label !== "Save this insight" && prompt.label === "Generate report",
  );
  const primaryPrompts = railPrompts.filter(
    (prompt) => prompt.label !== "Save this insight" && prompt.label !== "Generate report",
  );
  const saveDetail =
    savePrompt?.prompt ??
    `Save the clearest insight from ${title} with visible evidence, confidence and one next action.`;

  return (
    <aside
      aria-label={`${title} insight rail`}
      className={cn(
        "hidden min-w-0 gap-4 xl:sticky xl:top-[4.75rem] xl:grid xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto xl:pr-1",
        className,
      )}
    >
      <DataPanel className="gap-0 py-0">
        <SectionHeader
          title={title}
          description={description}
          action={<Bot className="size-5 text-primary" aria-hidden />}
        />
        <CardContent className="grid gap-3 p-3">
          {metrics?.length ? (
            <div className="grid gap-2">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-border/80 bg-card/78 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                    <StatusPill tone={metric.tone ?? "slate"}>{metric.value}</StatusPill>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-foreground">{metric.detail}</p>
                </div>
              ))}
            </div>
          ) : null}

          {evidence?.length ? (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="size-4" aria-hidden />
                Evidence to cite
              </p>
              <ul className="mt-2 grid gap-1.5 text-sm leading-5 text-foreground/80">
                {evidence.map((item) => (
                  <li key={item} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                    <span aria-hidden>-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {railPrompts.length ? (
            <div className="grid gap-2">
              {primaryPrompts.length ? <AiPromptList prompts={primaryPrompts} /> : null}
              <DesktopSaveInsightButton
                title={`${title} insight`}
                detail={saveDetail}
                group="AI insight"
              />
              {reportPrompts.length ? <AiPromptList prompts={reportPrompts} /> : null}
            </div>
          ) : null}

          {actions?.length ? (
            <div className="grid gap-2">
              {actions.map((action) => {
                const Icon = action.icon ?? ArrowRight;

                return (
                  <Link
                    key={`${action.label}-${action.href}`}
                    href={action.href}
                    prefetch={false}
                    className="focus-aaa grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card/78 px-3 py-2 outline-none hover:border-primary/40 hover:bg-card"
                  >
                    <Icon className="size-4 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{action.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {action.detail}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </DataPanel>
    </aside>
  );
}

function AiPromptList({ prompts }: { prompts: DesktopAiPrompt[] }) {
  return (
    <div className="grid gap-2">
      {prompts.map((prompt) => {
        const Icon = prompt.icon ?? Brain;

        return (
          <Button
            key={`${prompt.label}-${prompt.prompt}`}
            asChild
            variant="outline"
            className="h-auto min-h-11 justify-start whitespace-normal text-left"
          >
            <Link href={dataChatHref(prompt.prompt)} prefetch={false}>
              <Icon className="size-4" />
              <span>{prompt.label}</span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

export function commonAiPrompts(context: string): DesktopAiPrompt[] {
  return [
    {
      label: "Explain this page",
      prompt: `Explain the current ${context} page using only visible or available ForeKingHell metrics. Do not invent missing numbers.`,
      icon: Lightbulb,
    },
    {
      label: "What changed?",
      prompt: `Compare my current ${context} evidence with the previous useful period. Cite the metrics you use and call out weak evidence.`,
      icon: Sparkles,
    },
    {
      label: "Build practice plan",
      prompt: `Build a practice plan from this ${context} evidence. Keep it golfer-facing and mark any low-confidence recommendation.`,
      icon: Target,
    },
    {
      label: "Generate report",
      prompt: `Generate a performance report from this ${context} workspace with summary, strongest improvement, biggest weakness, confidence, and next practice action.`,
      icon: FileText,
    },
  ];
}

export function dataChatHref(prompt: string) {
  return `/data-chat?prompt=${encodeURIComponent(prompt)}`;
}

export function InsightBadge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "slate";
}) {
  const className =
    tone === "green"
      ? "bg-[var(--status-success-surface)] text-[var(--status-success-foreground)] hover:bg-[var(--status-success-surface)]"
      : tone === "amber"
        ? "bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)] hover:bg-[var(--status-warning-surface)]"
        : "bg-muted text-muted-foreground hover:bg-muted";

  return <Badge className={className}>{children}</Badge>;
}
