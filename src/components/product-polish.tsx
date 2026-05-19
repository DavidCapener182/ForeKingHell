import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, Eye, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataPanel, SectionHeader, StatusPill, type Tone } from "@/components/premium";

type ChecklistStatus = "ready" | "needed" | "optional";

type ChecklistItem = {
  label: string;
  detail: string;
  status?: ChecklistStatus;
  href?: string;
};

type FlowStep = {
  title: string;
  detail: string;
  href?: string;
  status?: ChecklistStatus;
};

type PreviewAudience = {
  label: string;
  value: ReactNode;
  detail: string;
};

const statusTone: Record<ChecklistStatus, Tone> = {
  ready: "green",
  needed: "amber",
  optional: "slate",
};

const statusLabel: Record<ChecklistStatus, string> = {
  ready: "Ready",
  needed: "Needed",
  optional: "Optional",
};

export function ProofChecklistPanel({
  title = "Proof checklist",
  description = "Make verification requirements visible before a player submits a record, tournament or leaderboard attempt.",
  items,
  actionHref,
  actionLabel = "Review proof",
}: {
  title?: string;
  description?: string;
  items: ChecklistItem[];
  actionHref?: string;
  actionLabel?: string;
}) {
  const readyCount = items.filter((item) => (item.status ?? "ready") === "ready").length;

  return (
    <DataPanel>
      <SectionHeader
        title={title}
        description={description}
        action={
          actionHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={actionHref} prefetch={false}>
                <ShieldCheck className="size-4" />
                {actionLabel}
              </Link>
            </Button>
          ) : (
            <StatusPill tone={readyCount === items.length ? "green" : "amber"}>
              {readyCount}/{items.length}
            </StatusPill>
          )
        }
      />
      <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => {
          const status = item.status ?? "ready";
          const content = (
            <div className="h-full rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold leading-5">{item.label}</p>
                <StatusPill tone={statusTone[status]}>{statusLabel[status]}</StatusPill>
              </div>
              <p className="mt-2 leading-5 text-muted-foreground">{item.detail}</p>
            </div>
          );

          return item.href ? (
            <Link key={item.label} href={item.href} prefetch={false} className="block">
              {content}
            </Link>
          ) : (
            <div key={item.label}>{content}</div>
          );
        })}
      </div>
    </DataPanel>
  );
}

export function DataFirstFlowPanel({
  title,
  description,
  steps,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  steps: FlowStep[];
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <DataPanel>
      <SectionHeader
        title={title}
        description={description}
        action={
          actionHref && actionLabel ? (
            <Button asChild variant="outline" size="sm">
              <Link href={actionHref} prefetch={false}>
                {actionLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="grid gap-2 p-4 md:grid-cols-5">
        {steps.map((step, index) => {
          const status = step.status ?? (index === 0 ? "ready" : "optional");
          const stepCard = (
            <div className="h-full rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-7 place-items-center rounded-full bg-[#F5F6F4] text-xs font-semibold">
                  {index + 1}
                </span>
                {status === "ready" ? (
                  <CheckCircle2 className="size-4 text-emerald-700" />
                ) : (
                  <CircleDashed className="size-4 text-muted-foreground" />
                )}
              </div>
              <p className="mt-3 font-semibold leading-5">{step.title}</p>
              <p className="mt-1 leading-5 text-muted-foreground">{step.detail}</p>
            </div>
          );

          return step.href ? (
            <Link key={step.title} href={step.href} prefetch={false}>
              {stepCard}
            </Link>
          ) : (
            <div key={step.title}>{stepCard}</div>
          );
        })}
      </div>
    </DataPanel>
  );
}

export function PublicSharePreviewPanel({
  audiences,
  actionHref = "/settings",
  actionLabel = "Privacy settings",
}: {
  audiences: PreviewAudience[];
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <DataPanel>
      <SectionHeader
        title="Public share preview"
        description="Show what different audiences can see before a tester posts to a group, challenge or public profile."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={actionHref} prefetch={false}>
              <Lock className="size-4" />
              {actionLabel}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {audiences.map((audience, index) => (
          <div key={audience.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{audience.label}</p>
              {index === 0 ? (
                <Eye className="size-4 text-sky-700" />
              ) : (
                <ShieldCheck className="size-4 text-emerald-700" />
              )}
            </div>
            <p className="mt-3 text-lg font-semibold tracking-normal">{audience.value}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{audience.detail}</p>
          </div>
        ))}
      </div>
    </DataPanel>
  );
}
