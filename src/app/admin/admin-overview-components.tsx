import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OperationalStatus = "failure" | "queue" | "recorded-none" | "unverified";

export type OperationalStatusItem = {
  label: string;
  value: string;
  detail: string;
  status: OperationalStatus;
};

export function OperationalStatusStrip({ items }: { items: OperationalStatusItem[] }) {
  return (
    <div className="grid overflow-hidden rounded-lg border border-border bg-background md:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="min-w-0 border-b border-border px-3 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
        >
          <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {item.label}
          </p>
          <div className="mt-2">
            <OperationalBadge status={item.status}>{item.value}</OperationalBadge>
          </div>
          <p className="mt-2 text-xs leading-4 text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function OperationsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function OperationalBadge({
  status,
  children,
}: {
  status: OperationalStatus;
  children: ReactNode;
}) {
  return (
    <Badge
      variant={status === "failure" ? "destructive" : status === "queue" ? "secondary" : "outline"}
      className={cn(
        "rounded-md font-medium",
        status === "unverified" && "border-dashed text-muted-foreground",
      )}
    >
      {children}
    </Badge>
  );
}
