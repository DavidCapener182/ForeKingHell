import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, CreditCard, Flag, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const adminLinks = [
  { href: "/admin", label: "Overview", icon: Activity },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
  { href: "/admin/challenges", label: "Challenges", icon: Flag },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Admin sections">
      {adminLinks.map((item) => {
        const Icon = item.icon;
        const current = item.href === active;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              current
                ? "inline-flex h-9 items-center gap-2 rounded-xl bg-[#111827] px-3 text-sm font-semibold text-white"
                : "inline-flex h-9 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-medium text-muted-foreground shadow-sm hover:bg-slate-50"
            }
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNotice({ status, error }: { status?: string; error?: string }) {
  if (!status && !error) {
    return null;
  }

  return (
    <div className={error ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" : "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"}>
      {error ?? status}
    </div>
  );
}

export function AdminMetric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-emerald-600" />
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function AdminSection({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-normal">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  const tone = plan === "full" ? "default" : plan === "free" ? "outline" : "secondary";
  return <Badge variant={tone}>{label(plan)}</Badge>;
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const safeStatus = status ?? "unknown";
  return <Badge variant={safeStatus === "active" || safeStatus === "open" ? "secondary" : "outline"}>{label(safeStatus)}</Badge>;
}

export function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
