"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Brain,
  Calculator,
  CalendarDays,
  ChevronDown,
  Database,
  Flag,
  Gauge,
  GitCompareArrows,
  LineChart,
  LogOut,
  MapPinned,
  MoreHorizontal,
  Settings,
  Target,
  Upload,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { calculateUserLevel } from "@/lib/achievements/xp";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/today", label: "Today", icon: CalendarDays, isActive: (pathname: string) => pathname.startsWith("/today") },
      { href: "/dashboard", label: "Dashboard", icon: Gauge, isActive: (pathname: string) => pathname === "/" || pathname === "/dashboard" },
      { href: "/progress", label: "Progress", icon: LineChart, isActive: (pathname: string) => pathname.startsWith("/progress") },
      { href: "/strokes-gained", label: "Strokes gained", icon: LineChart, isActive: (pathname: string) => pathname.startsWith("/strokes-gained") },
    ],
  },
  {
    label: "Play",
    items: [
      { href: "/rounds", label: "Rounds", icon: Flag, isActive: (pathname: string) => pathname.startsWith("/rounds") },
      { href: "/courses", label: "Courses", icon: MapPinned, isActive: (pathname: string) => pathname.startsWith("/courses") },
      { href: "/handicap", label: "Handicap", icon: Calculator, isActive: (pathname: string) => pathname.startsWith("/handicap") },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/compare", label: "Compare", icon: GitCompareArrows, isActive: (pathname: string) => pathname.startsWith("/compare") },
      { href: "/bag", label: "Bag", icon: Target, isActive: (pathname: string) => pathname.startsWith("/bag") },
      { href: "/equipment", label: "Equipment", icon: Wrench, isActive: (pathname: string) => pathname.startsWith("/equipment") },
      { href: "/shots", label: "Shots", icon: Database, isActive: (pathname: string) => pathname.startsWith("/shots") },
      { href: "/rapsodo", label: "Rapsodo", icon: Upload, isActive: (pathname: string) => pathname.startsWith("/rapsodo") },
    ],
  },
  {
    label: "Improve",
    items: [
      { href: "/coach", label: "Coach", icon: Brain, isActive: (pathname: string) => pathname.startsWith("/coach") },
      { href: "/achievements", label: "Achievements", icon: Award, isActive: (pathname: string) => pathname.startsWith("/achievements") },
      { href: "/leaderboard", label: "Leaderboards", icon: Users, isActive: (pathname: string) => pathname.startsWith("/leaderboard") },
      { href: "/settings", label: "Settings", icon: Settings, isActive: (pathname: string) => pathname.startsWith("/settings") },
    ],
  },
];

const mobilePrimaryItems = [
  { href: "/today", label: "Today", icon: CalendarDays, isActive: (pathname: string) => pathname === "/" || pathname.startsWith("/today") },
  { href: "/import", label: "Import", icon: Upload, isActive: (pathname: string) => pathname.startsWith("/import") },
  { href: "/bag", label: "Bag", icon: Target, isActive: (pathname: string) => pathname.startsWith("/bag") },
  { href: "/rounds", label: "Rounds", icon: Flag, isActive: (pathname: string) => pathname.startsWith("/rounds") },
  { href: "/coach", label: "Coach", icon: Brain, isActive: (pathname: string) => pathname.startsWith("/coach") },
];

const moreItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/rapsodo", label: "Rapsodo", icon: Upload },
  { href: "/shots", label: "Shots", icon: Database },
  { href: "/courses", label: "Courses", icon: MapPinned },
  { href: "/handicap", label: "Handicap", icon: Calculator },
  { href: "/strokes-gained", label: "Strokes gained", icon: LineChart },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/achievements", label: "Achievements", icon: Award },
  { href: "/leaderboard", label: "Leaderboards", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

const xpFormatter = new Intl.NumberFormat("en-GB");

export function AppNav({ totalXp }: { totalXp: number }) {
  const pathname = usePathname();
  const level = calculateUserLevel(totalXp);
  const xpToNextLevel = Math.max(0, level.nextLevelXp - totalXp);

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/privacy")
  ) {
    return null;
  }

  return (
    <>
      <div className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8">
        <nav
          aria-label="Primary"
          className="glass-toolbar mx-auto flex w-full max-w-7xl items-center gap-2 rounded-xl p-2 sm:rounded-2xl"
        >
          <Link
            href="/dashboard"
            prefetch={false}
            className="flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#111827] text-white">
              <Flag className="size-4" />
            </span>
            <span className="hidden truncate sm:inline">ForeKingHell</span>
            <span className="truncate sm:hidden">FKH</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-visible lg:flex">
            {navGroups.map((group) => {
              const groupActive = group.items.some((item) => item.isActive(pathname));
              const menuId = `desktop-nav-${group.label.toLowerCase()}`;

              return (
                <div key={group.label} className="group/desktop-nav relative">
                  <Button
                    type="button"
                    variant={groupActive ? "default" : "ghost"}
                    aria-haspopup="menu"
                    aria-controls={menuId}
                    className={
                      groupActive
                        ? "h-9 rounded-xl bg-[#111827] px-3 text-white shadow-sm hover:bg-[#111827] hover:text-white focus-visible:bg-[#111827] focus-visible:text-white"
                        : "h-9 rounded-xl px-3 text-muted-foreground hover:bg-[#111827] hover:text-white focus-visible:bg-[#111827] focus-visible:text-white group-hover/desktop-nav:bg-[#111827] group-hover/desktop-nav:text-white group-focus-within/desktop-nav:bg-[#111827] group-focus-within/desktop-nav:text-white"
                    }
                  >
                    {group.label}
                    <ChevronDown className="size-4 transition-transform group-hover/desktop-nav:rotate-180 group-focus-within/desktop-nav:rotate-180" />
                  </Button>

                  <div
                    id={menuId}
                    role="menu"
                    className="pointer-events-none invisible absolute left-0 top-full z-50 grid min-w-52 translate-y-1 gap-1 rounded-2xl border border-white/60 bg-white/95 p-2 opacity-0 shadow-xl shadow-black/10 backdrop-blur transition duration-150 group-hover/desktop-nav:pointer-events-auto group-hover/desktop-nav:visible group-hover/desktop-nav:translate-y-0 group-hover/desktop-nav:opacity-100 group-focus-within/desktop-nav:pointer-events-auto group-focus-within/desktop-nav:visible group-focus-within/desktop-nav:translate-y-0 group-focus-within/desktop-nav:opacity-100"
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = item.isActive(pathname);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={false}
                          role="menuitem"
                          aria-current={active ? "page" : undefined}
                          className={
                            active
                              ? "flex items-center gap-2 rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white"
                              : "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                          }
                        >
                          <Icon className={active ? "size-4 text-emerald-300" : "size-4 text-muted-foreground"} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden min-w-0 flex-1 gap-1 overflow-x-auto sm:flex lg:hidden">
            {mobilePrimaryItems.map((item) => {
              const Icon = item.icon;
              const active = item.isActive(pathname);

              return (
                <Button
                  key={item.href}
                  asChild
                  variant={active ? "default" : "ghost"}
                  className={active ? "h-9 rounded-xl bg-[#111827] text-white" : "h-9 rounded-xl"}
                >
                  <Link href={item.href} prefetch={false} aria-current={active ? "page" : undefined}>
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </div>

          <Button asChild className="ml-auto hidden h-9 shrink-0 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 sm:inline-flex">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>

          <Link
            href="/achievements"
            prefetch={false}
            aria-label={`Level ${level.level}, ${xpFormatter.format(totalXp)} XP, ${xpFormatter.format(xpToNextLevel)} XP to next level`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-3 text-sm font-medium text-white shadow-sm"
          >
            <Zap className="size-4 text-emerald-300" />
            <span>Lvl {level.level}</span>
          </Link>
          <form action="/auth/sign-out" method="post" className="hidden sm:block">
            <Button type="submit" variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </form>
        </nav>
      </div>

      <nav aria-label="Mobile primary" className="fixed inset-x-3 bottom-3 z-50 sm:hidden">
        <div className="glass-toolbar grid grid-cols-6 gap-1 rounded-2xl p-1.5">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex flex-col items-center gap-0.5 rounded-xl bg-[#111827] px-1 py-2 text-[11px] font-semibold text-white"
                    : "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-medium text-muted-foreground"
                }
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <details className="group relative">
            <summary className="flex h-full cursor-pointer list-none flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
              <MoreHorizontal className="size-4" />
              More
            </summary>
            <div className="absolute bottom-full right-0 mb-2 grid min-w-44 gap-1 rounded-2xl border bg-white p-2 shadow-xl">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} prefetch={false} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        </div>
      </nav>
    </>
  );
}
