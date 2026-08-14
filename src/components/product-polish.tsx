import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, Eye, Lock, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

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

const statusLabel: Record<ChecklistStatus, string> = {
  ready: "Ready",
  needed: "Needed",
  optional: "Optional",
};

const statusBadgeClass: Record<ChecklistStatus, string> = {
  ready:
    "border-[var(--status-success-border)] bg-[var(--status-success-surface)] text-[var(--status-success-foreground)] hover:bg-[var(--status-success-surface)]",
  needed:
    "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)] hover:bg-[var(--status-warning-surface)]",
  optional: "border-border bg-muted/55 text-muted-foreground hover:bg-muted/55",
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
  const overallStatus: ChecklistStatus = readyCount === items.length ? "ready" : "needed";

  return (
    <Card className="gap-0 bg-card py-0 shadow-sm ring-border" data-product-polish-panel="proof">
      <CardHeader className="gap-1 border-b border-border/70 px-4 py-3">
        <CardTitle className="text-lg font-semibold tracking-normal sm:text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          {actionHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={actionHref} prefetch={false}>
                <ShieldCheck className="size-4" />
                {actionLabel}
              </Link>
            </Button>
          ) : (
            <Badge variant="outline" className={statusBadgeClass[overallStatus]}>
              {readyCount}/{items.length}
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-2 sm:grid-cols-2 min-[1800px]:grid-cols-3 min-[2400px]:grid-cols-5">
          {items.map((item) => {
            const status = item.status ?? "ready";
            const content = (
              <Item variant="outline" className="h-full items-start">
                <ItemContent>
                  <ItemTitle className="whitespace-normal [overflow:visible] [text-overflow:clip]">
                    {item.label}
                  </ItemTitle>
                  <ItemDescription className="mt-1 whitespace-normal [overflow:visible] [text-overflow:clip]">
                    {item.detail}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline" className={statusBadgeClass[status]}>
                    {statusLabel[status]}
                  </Badge>
                </ItemActions>
              </Item>
            );

            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                prefetch={false}
                className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {content}
              </Link>
            ) : (
              <div key={item.label} className="h-full">
                {content}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
    <Card className="gap-0 bg-card py-0 shadow-sm ring-border" data-product-polish-panel="flow">
      <CardHeader className="gap-1 border-b border-border/70 px-4 py-3">
        <CardTitle className="text-lg font-semibold tracking-normal sm:text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {actionHref && actionLabel ? (
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link href={actionHref} prefetch={false}>
                {actionLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-2 sm:grid-cols-2 min-[1800px]:grid-cols-3 min-[2400px]:grid-cols-5">
          {steps.map((step, index) => {
            const status = step.status ?? (index === 0 ? "ready" : "optional");
            const stepItem = (
              <Item variant="outline" className="h-full items-start">
                <ItemMedia>
                  <Badge variant="secondary" className="size-7 rounded-full p-0">
                    {index + 1}
                  </Badge>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="whitespace-normal [overflow:visible] [text-overflow:clip]">
                    {step.title}
                  </ItemTitle>
                  <ItemDescription className="mt-1 whitespace-normal [overflow:visible] [text-overflow:clip]">
                    {step.detail}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {status === "ready" ? (
                    <CheckCircle2
                      className="size-4 text-[var(--status-success-foreground)]"
                      aria-label="Ready"
                    />
                  ) : (
                    <CircleDashed
                      className="size-4 text-muted-foreground"
                      aria-label={statusLabel[status]}
                    />
                  )}
                </ItemActions>
              </Item>
            );

            return step.href ? (
              <Link
                key={step.title}
                href={step.href}
                prefetch={false}
                className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {stepItem}
              </Link>
            ) : (
              <div key={step.title} className="h-full">
                {stepItem}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
    <Card className="gap-0 bg-card py-0 shadow-sm ring-border" data-product-polish-panel="share">
      <CardHeader className="gap-1 border-b border-border/70 px-4 py-3">
        <CardTitle className="text-lg font-semibold tracking-normal sm:text-xl">
          Public share preview
        </CardTitle>
        <CardDescription>
          Show what different audiences can see before a tester posts to a group, challenge or
          public profile.
        </CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href={actionHref} prefetch={false}>
              <Lock className="size-4" />
              {actionLabel}
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-4">
        <div className="ios-share-audiences grid gap-3 md:grid-cols-3">
          {audiences.map((audience, index) => (
            <Item
              key={audience.label}
              variant="outline"
              className="ios-share-audience h-full items-start"
            >
              <ItemContent>
                <ItemTitle className="whitespace-normal [overflow:visible] [text-overflow:clip]">
                  {audience.label}
                </ItemTitle>
                <div className="mt-2 text-lg font-semibold tracking-normal">{audience.value}</div>
                <ItemDescription className="mt-1 whitespace-normal [overflow:visible] [text-overflow:clip]">
                  {audience.detail}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                {index === 0 ? (
                  <Eye className="size-4 text-primary" />
                ) : (
                  <ShieldCheck className="size-4 text-[var(--status-success-foreground)]" />
                )}
              </ItemActions>
            </Item>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
