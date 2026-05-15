import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ChevronDown,
  MessageCircle,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  ThumbsUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MobileAppShellProps = {
  children: ReactNode;
  className?: string;
};

export function MobileAppShell({ children, className }: MobileAppShellProps) {
  return (
    <section
      className={cn(
        "-mx-4 -mt-5 grid min-h-screen content-start gap-4 overflow-x-clip bg-white px-4 pb-[calc(7.25rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] text-[#050505] sm:hidden [&>*]:min-w-0",
        className,
      )}
    >
      {children}
    </section>
  );
}

type MobileTopBarProps = {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function MobileTopBar({
  title,
  leading,
  actions,
  className,
}: MobileTopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 -mx-4 -mb-4 -mt-[calc(0.75rem+env(safe-area-inset-top))] h-[calc(6.75rem+env(safe-area-inset-top)+1px)] w-auto min-w-0 overflow-hidden border-b border-[#E5E7EB] bg-white px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]",
        className,
      )}
    >
      <div className="h-12" aria-hidden="true" />
      <div className="-mx-4 grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-t border-[#E5E7EB] px-4">
        <div className="flex min-w-0 items-center justify-start gap-1.5">
          {leading}
        </div>
        <h1 className="max-w-[12rem] truncate text-center text-[1.35rem] font-semibold leading-7 tracking-normal">
          {title}
        </h1>
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          {actions}
        </div>
      </div>
    </header>
  );
}

export function MobileIconButton({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="size-10 rounded-full text-[#050505]"
    >
      <Link href={href} prefetch={false} aria-label={label}>
        <Icon className="size-5" />
      </Link>
    </Button>
  );
}

export type MobileTab = {
  key: string;
  label: string;
  href: string;
};

const mobileRouteGroups = {
  dashboard: [
    { key: "today", label: "Today", href: "/today" },
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "progress", label: "Progress", href: "/progress" },
    { key: "strokes", label: "Strokes gained", href: "/strokes-gained" },
  ],
  play: [
    { key: "rounds", label: "Rounds", href: "/rounds" },
    { key: "courses", label: "Courses", href: "/courses" },
    { key: "records", label: "Records", href: "/course-records" },
    { key: "tournaments", label: "Tournaments", href: "/tournaments" },
    { key: "handicap", label: "Handicap", href: "/handicap" },
  ],
  analyse: [
    { key: "compare", label: "Compare", href: "/compare" },
    { key: "bag", label: "Bag", href: "/bag" },
    { key: "equipment", label: "Equipment", href: "/equipment" },
    { key: "shots", label: "Shots", href: "/shots" },
    { key: "rapsodo", label: "Rapsodo", href: "/rapsodo" },
  ],
  improve: [
    { key: "coach", label: "Coach", href: "/coach" },
    { key: "achievements", label: "Achievements", href: "/achievements" },
    { key: "settings", label: "Settings", href: "/settings" },
  ],
  social: [
    { key: "feed", label: "Feed", href: "/feed" },
    { key: "friends", label: "Friends", href: "/friends" },
    { key: "groups", label: "Groups", href: "/groups" },
    { key: "challenges", label: "Challenges", href: "/challenges" },
    { key: "leaderboard", label: "Leaderboards", href: "/leaderboard" },
    { key: "profile", label: "Profile", href: "/profile" },
    { key: "recaps", label: "Recaps", href: "/social-intelligence" },
  ],
  platform: [
    { key: "billing", label: "Billing", href: "/billing" },
    { key: "providers", label: "Providers", href: "/providers" },
  ],
} satisfies Record<string, MobileTab[]>;

type MobileRouteGroup = keyof typeof mobileRouteGroups;

export function MobileRouteTabs({
  group,
  activeKey,
  className,
  sticky = true,
}: {
  group: MobileRouteGroup;
  activeKey: string;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <MobileTabBar
      tabs={mobileRouteGroups[group]}
      activeKey={activeKey}
      className={cn(
        sticky
          ? "sticky top-[calc(6.75rem+env(safe-area-inset-top)+1px)] z-40 bg-white"
          : "",
        className,
      )}
    />
  );
}

export function MobileRouteHeader({
  title,
  group,
  activeKey,
  className,
}: {
  title: string;
  group: MobileRouteGroup;
  activeKey: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "sticky top-0 z-40 -mx-4 -mt-5 grid min-w-0 gap-0 bg-white px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:hidden",
        className,
      )}
    >
      <div className="-mx-4 h-12 px-4" aria-hidden="true" />
      <header className="-mx-4 grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-y border-[#E5E7EB] px-4">
        <span aria-hidden="true" />
        <h1 className="truncate text-center text-[1.35rem] font-semibold leading-7 tracking-normal text-[#050505]">
          {title}
        </h1>
        <span aria-hidden="true" />
      </header>
      <MobileRouteTabs group={group} activeKey={activeKey} sticky={false} />
    </section>
  );
}

export function MobileTabBar({
  tabs,
  activeKey,
  className,
}: {
  tabs: MobileTab[];
  activeKey: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Mobile tabs"
      className={cn(
        "-mx-4 flex min-w-0 gap-6 overflow-x-auto border-b border-[#E5E7EB] px-4",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 py-3 text-base font-semibold tracking-normal",
              active
                ? "border-[#0B7A3B] text-[#050505]"
                : "border-transparent text-[#6B7280]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileStatusAction({
  label,
  value,
  detail,
  action,
}: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-[#E5E7EB] pb-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#6B7280]">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tracking-normal text-[#050505]">
          {value}
        </p>
        {detail ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#6B7280]">
            {detail}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}

export function NativeListSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("grid gap-3", className)}>
      {title || action ? (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-xl font-semibold tracking-normal text-[#050505]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-5 text-[#6B7280]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

export function BottomSheet({
  label,
  title,
  children,
  triggerClassName,
}: {
  label: ReactNode;
  title: ReactNode;
  children: ReactNode;
  triggerClassName?: string;
}) {
  return (
    <details className="group sm:hidden">
      <summary
        className={cn(
          "inline-flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-full bg-[#0B7A3B] px-4 text-sm font-semibold text-white shadow-sm [&::-webkit-details-marker]:hidden",
          triggerClassName,
        )}
      >
        {label}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[84vh] overflow-y-auto rounded-t-[1.25rem] border border-[#E5E7EB] bg-white p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] shadow-lg shadow-black/10">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E7EB]" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-normal text-[#050505]">
            {title}
          </h2>
          <MoreHorizontal className="size-5 text-[#6B7280]" />
        </div>
        {children}
      </div>
    </details>
  );
}

export function ProofBadge({
  tier,
  className,
}: {
  tier: string | null | undefined;
  className?: string;
}) {
  const normalized = (tier ?? "manual").toLowerCase();
  const label =
    normalized === "gold"
      ? "Gold verified"
      : normalized === "silver"
        ? "Silver verified"
        : normalized === "bronze"
          ? "Bronze review"
          : normalized === "manual"
            ? "Manual"
            : normalized.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        normalized === "gold"
          ? "bg-[#C7972B]/15 text-[#7A5410]"
          : normalized === "silver"
            ? "bg-[#F5F6F4] text-[#050505]"
            : normalized === "bronze"
              ? "bg-orange-50 text-orange-700"
              : "bg-[#F5F6F4] text-[#6B7280]",
        className,
      )}
    >
      <ShieldCheck className="size-3" />
      {label}
    </span>
  );
}

type ActivityCardProps = {
  avatar?: ReactNode;
  actor: ReactNode;
  meta: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metric?: ReactNode;
  media?: ReactNode;
  href?: string;
  reactionCount?: number;
  commentCount?: number;
  action?: ReactNode;
};

export function ActivityCard({
  avatar,
  actor,
  meta,
  title,
  description,
  metric,
  media,
  href,
  reactionCount = 0,
  commentCount = 0,
  action,
}: ActivityCardProps) {
  const content = (
    <article className="overflow-hidden border-b border-[#E5E7EB] bg-white pb-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
        <div className="pt-0.5">{avatar}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#050505]">
            {actor}
          </p>
          <p className="truncate text-xs text-[#6B7280]">{meta}</p>
        </div>
        {action ?? <MoreHorizontal className="size-5 text-[#6B7280]" />}
      </div>
      <div className="mt-3 grid gap-3">
        <div>
          <h2 className="text-xl font-semibold leading-6 tracking-normal text-[#050505]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-[#6B7280]">
              {description}
            </p>
          ) : null}
        </div>
        {metric ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-[#F5F6F4] px-3 py-2">
            <div className="min-w-0 text-sm font-semibold text-[#050505]">
              {metric}
            </div>
            <ProofBadge tier="gold" />
          </div>
        ) : null}
        {media ? <div className="overflow-hidden rounded-lg">{media}</div> : null}
        <div className="flex items-center gap-5 text-sm font-semibold text-[#6B7280]">
          <span className="inline-flex items-center gap-1.5">
            <ThumbsUp className="size-4" />
            Kudos{reactionCount ? ` ${reactionCount}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-4" />
            Comment{commentCount ? ` ${commentCount}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Share2 className="size-4" />
            Share
          </span>
        </div>
      </div>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} prefetch={false} className="block">
      {content}
    </Link>
  );
}

export function EventHeroCard({
  eyebrow,
  title,
  description,
  meta,
  media,
  href,
  actionLabel = "Open",
  joined,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  media?: ReactNode;
  href: string;
  actionLabel?: string;
  joined?: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      {media ? <div className="h-40 overflow-hidden bg-[#F5F6F4]">{media}</div> : null}
      <div className="grid gap-3 p-3">
        {eyebrow ? (
          <p className="text-sm font-semibold text-[#0B7A3B]">{eyebrow}</p>
        ) : null}
        <div>
          <h2 className="text-2xl font-semibold leading-7 tracking-normal text-[#050505]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-[#6B7280]">
              {description}
            </p>
          ) : null}
        </div>
        {meta ? <div className="text-sm text-[#6B7280]">{meta}</div> : null}
        <div className="flex items-center justify-between gap-3">
          <Button asChild className="rounded-full bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
            <Link href={href} prefetch={false}>
              {actionLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {joined ? <div className="shrink-0">{joined}</div> : null}
        </div>
      </div>
    </article>
  );
}

export function ChallengeCard({
  title,
  description,
  meta,
  leader,
  href,
  cta = "Open",
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leader?: ReactNode;
  href: string;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-normal text-[#050505]">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#6B7280]">
              {description}
            </p>
          ) : null}
        </div>
        <Trophy className="size-5 shrink-0 text-[#C7972B]" />
      </div>
      <div className="flex flex-wrap gap-2 text-xs font-medium text-[#6B7280]">
        {meta}
      </div>
      {leader ? (
        <div className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm text-[#050505]">
          {leader}
        </div>
      ) : null}
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0B7A3B]">
        {cta}
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}

export const TournamentCard = ChallengeCard;

export function CourseCard({
  title,
  subtitle,
  champion,
  stats,
  href,
  media,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  champion?: ReactNode;
  stats?: ReactNode;
  href: string;
  media?: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="grid gap-3 border-b border-[#E5E7EB] bg-white pb-4"
    >
      {media ? <div className="overflow-hidden rounded-lg">{media}</div> : null}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-normal text-[#050505]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 truncate text-sm text-[#6B7280]">{subtitle}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-[#F5F6F4] px-3 py-1 text-sm font-semibold text-[#0B7A3B]">
          Open
        </span>
      </div>
      {champion ? (
        <div className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm">
          {champion}
        </div>
      ) : null}
      {stats ? <div className="flex flex-wrap gap-2 text-xs text-[#6B7280]">{stats}</div> : null}
    </Link>
  );
}

export function CourseRecordCard({
  title,
  champion,
  score,
  proof,
  href,
  cta = "Challenge",
}: {
  title: ReactNode;
  champion?: ReactNode;
  score?: ReactNode;
  proof?: string | null;
  href: string;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0B7A3B]">{title}</p>
          <h3 className="mt-2 truncate text-2xl font-semibold tracking-normal text-[#050505]">
            {champion ?? "Open board"}
          </h3>
        </div>
        <p className="shrink-0 text-3xl font-semibold tracking-normal text-[#050505]">
          {score ?? "--"}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <ProofBadge tier={proof} />
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0B7A3B]">
          {cta}
          <ArrowRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}

export function PodiumStrip({
  items,
}: {
  items: Array<{
    rank: number | null;
    name: ReactNode;
    value: ReactNode;
    detail?: ReactNode;
  }>;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-white p-4 text-sm text-[#6B7280]">
        No entries yet.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {items.slice(0, 3).map((item) => (
        <div
          key={`${item.rank}-${String(item.name)}`}
          className={cn(
            "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2",
            item.rank === 1
              ? "bg-[#C7972B]/12 text-[#050505]"
              : "bg-[#F5F6F4] text-[#050505]",
          )}
        >
          <Badge variant={item.rank === 1 ? "default" : "outline"}>
            #{item.rank ?? "--"}
          </Badge>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{item.name}</p>
            {item.detail ? (
              <p className="truncate text-xs text-[#6B7280]">{item.detail}</p>
            ) : null}
          </div>
          <p className="font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function CompactLeaderboard({
  items,
  current,
  viewAllHref,
}: {
  items: Array<{
    rank: number | null;
    name: ReactNode;
    value: ReactNode;
    detail?: ReactNode;
  }>;
  current?: ReactNode;
  viewAllHref?: string;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3">
      {current ? (
        <div className="rounded-lg bg-[#F5F6F4] px-3 py-2 text-sm font-semibold text-[#050505]">
          {current}
        </div>
      ) : null}
      <PodiumStrip items={items} />
      {viewAllHref ? (
        <Button asChild variant="outline" className="rounded-full border-[#E5E7EB]">
          <Link href={viewAllHref} prefetch={false}>
            View full leaderboard
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

export function ProgressCard({
  title,
  value,
  detail,
  children,
}: {
  title: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="grid gap-3 rounded-lg border border-[#E5E7EB] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#6B7280]">{title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-normal text-[#050505]">
            {value}
          </p>
          {detail ? (
            <p className="mt-1 text-sm leading-5 text-[#6B7280]">{detail}</p>
          ) : null}
        </div>
        <span className="size-2 rounded-full bg-[#16A34A] ring-4 ring-[#16A34A]/15" />
      </div>
      {children}
    </article>
  );
}

export function PBCard({
  title,
  value,
  detail,
  href,
}: {
  title: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
}) {
  const content = (
    <article className="rounded-lg bg-[#F5F6F4] px-3 py-2">
      <p className="text-xs font-semibold text-[#6B7280]">{title}</p>
      <p className="mt-1 text-lg font-semibold tracking-normal text-[#050505]">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-[#6B7280]">{detail}</p> : null}
    </article>
  );

  return href ? (
    <Link href={href} prefetch={false}>
      {content}
    </Link>
  ) : (
    content
  );
}
