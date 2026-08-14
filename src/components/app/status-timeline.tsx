import Link from "next/link";
import { createElement, type ComponentType } from "react";
import { AlertTriangle, Check, Flag, Target, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type StatusTimelineItem = {
  id: string;
  dateGroup?: string;
  timestamp?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  kind?: "practice" | "round" | "import" | "reviewed" | "warning";
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  href?: string;
  action?: React.ReactNode;
  featured?: boolean;
};

export function StatusTimeline({
  items,
  label = "Activity timeline",
  empty,
  className,
}: {
  items: StatusTimelineItem[];
  label?: string;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (!items.length) return <>{empty ?? null}</>;

  return (
    <ScrollArea
      role="region"
      aria-label={label}
      className={cn("max-h-[36rem] min-w-0", className)}
      data-status-timeline
    >
      <div className="grid min-w-0 gap-0 pr-3">
        {items.map((item, index) => {
          const showGroup = item.dateGroup && item.dateGroup !== items[index - 1]?.dateGroup;
          return (
            <div key={item.id}>
              {showGroup ? (
                <>
                  {index > 0 ? <Separator className="my-3" /> : null}
                  <h2 className="pb-2 pt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {item.dateGroup}
                  </h2>
                </>
              ) : null}
              <TimelineItem item={item} last={index === items.length - 1} />
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function TimelineItem({ item, last }: { item: StatusTimelineItem; last: boolean }) {
  const content = (
    <div className="min-w-0 flex-1 pb-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">{item.title}</p>
          {item.timestamp ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.timestamp}</p>
          ) : null}
        </div>
        {item.status ? (
          <Badge variant="secondary" className="max-w-40 shrink-0 truncate">
            {item.status}
          </Badge>
        ) : null}
      </div>
      {item.description ? (
        <div className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</div>
      ) : null}
      {item.meta ? <div className="mt-2 text-xs font-medium">{item.meta}</div> : null}
      {item.action ? <div className="mt-3">{item.action}</div> : null}
    </div>
  );

  return (
    <article
      className={cn(
        "relative flex min-w-0 gap-3",
        item.featured &&
          "-mx-1 mb-2 rounded-xl border border-primary/20 bg-primary/[0.045] px-2 pt-2",
      )}
      data-timeline-kind={item.kind ?? "custom"}
      data-timeline-featured={item.featured ? "true" : undefined}
    >
      <div className="relative flex w-7 shrink-0 justify-center">
        {!last ? (
          <Separator
            orientation="vertical"
            className="absolute bottom-0 top-7 h-auto"
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            "relative z-10 grid size-7 place-items-center rounded-full border bg-card text-muted-foreground",
            item.kind === "warning" &&
              "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]",
            item.kind === "reviewed" && "border-primary/40 text-primary",
          )}
        >
          <TimelineIcon kind={item.kind} icon={item.icon} />
        </span>
      </div>
      {item.href ? (
        <Link
          href={item.href}
          className="focus-aaa -m-1 min-w-0 flex-1 rounded-lg p-1 outline-none hover:bg-muted/35"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </article>
  );
}

function TimelineIcon({
  kind,
  icon,
}: {
  kind: StatusTimelineItem["kind"];
  icon?: StatusTimelineItem["icon"];
}) {
  if (icon) return createElement(icon, { className: "size-3.5", "aria-hidden": true });
  if (kind === "practice") return <Target className="size-3.5" aria-hidden />;
  if (kind === "round") return <Flag className="size-3.5" aria-hidden />;
  if (kind === "import") return <Upload className="size-3.5" aria-hidden />;
  if (kind === "warning") return <AlertTriangle className="size-3.5" aria-hidden />;
  return <Check className="size-3.5" aria-hidden />;
}
