import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, CreditCard, Flag, ShieldCheck, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusPill, type Tone } from "@/components/premium";

const adminLinks = [
  { href: "/admin", label: "Overview", icon: Activity },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
  { href: "/admin/challenges", label: "Challenges", icon: Flag },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav aria-label="Admin sections">
      <ButtonGroup className="flex-wrap">
        {adminLinks.map((item) => {
          const Icon = item.icon;
          const current = item.href === active;

          return (
            <Button key={item.href} asChild variant={current ? "default" : "outline"} size="sm">
              <Link href={item.href} aria-current={current ? "page" : undefined}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </ButtonGroup>
    </nav>
  );
}

export function AdminNotice({ status, error }: { status?: string; error?: string }) {
  if (!status && !error) {
    return null;
  }

  return (
    <Alert variant={error ? "destructive" : "default"}>
      <AlertDescription>{error ?? status}</AlertDescription>
    </Alert>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  tone = "sky",
  action,
  visual,
}: {
  eyebrow: string;
  title: string;
  description: string;
  tone?: Tone;
  action?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <header className="premium-hero p-3 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <StatusPill tone={tone}>{eyebrow}</StatusPill>
          <h1 className="mt-2 text-lg font-semibold leading-tight tracking-normal sm:mt-3 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:leading-6">
            {description}
          </p>
        </div>
        {visual || action ? (
          <div className="flex shrink-0 items-start gap-3">
            {visual}
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function AdminMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Card className="premium-card">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4 text-emerald-600" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-normal">{value}</CardTitle>
      </CardHeader>
      {detail ? (
        <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
      ) : null}
    </Card>
  );
}

export function AdminSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="premium-card">
      <CardHeader>
        <div>
          <CardTitle className="text-base font-semibold tracking-normal">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  const tone = plan === "full" ? "default" : plan === "free" ? "outline" : "secondary";
  return <Badge variant={tone}>{label(plan)}</Badge>;
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const safeStatus = status ?? "unknown";
  return (
    <Badge variant={safeStatus === "active" || safeStatus === "open" ? "secondary" : "outline"}>
      {label(safeStatus)}
    </Badge>
  );
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
