"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Brain,
  Calculator,
  Database,
  Flag,
  Gauge,
  LineChart,
  MapPinned,
  MoreHorizontal,
  Target,
  Upload,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { calculateUserLevel } from "@/lib/achievements/xp";

const navGroups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Gauge, isActive: (pathname: string) => pathname === "/" || pathname === "/dashboard" },
      { href: "/progress", label: "Progress", icon: LineChart, isActive: (pathname: string) => pathname.startsWith("/progress") },
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
      { href: "/bag", label: "Bag", icon: Target, isActive: (pathname: string) => pathname.startsWith("/bag") },
      { href: "/shots", label: "Shots", icon: Database, isActive: (pathname: string) => pathname.startsWith("/shots") },
    ],
  },
  {
    label: "Improve",
    items: [
      { href: "/coach", label: "Coach", icon: Brain, isActive: (pathname: string) => pathname.startsWith("/coach") },
      { href: "/achievements", label: "Achievements", icon: Award, isActive: (pathname: string) => pathname.startsWith("/achievements") },
    ],
  },
];

const mobilePrimaryItems = [
  { href: "/dashboard", label: "Today", icon: Gauge, isActive: (pathname: string) => pathname === "/" || pathname === "/dashboard" },
  { href: "/import", label: "Import", icon: Upload, isActive: (pathname: string) => pathname.startsWith("/import") },
  { href: "/bag", label: "Bag", icon: Target, isActive: (pathname: string) => pathname.startsWith("/bag") },
  { href: "/rounds", label: "Rounds", icon: Flag, isActive: (pathname: string) => pathname.startsWith("/rounds") },
  { href: "/coach", label: "Coach", icon: Brain, isActive: (pathname: string) => pathname.startsWith("/coach") },
];

const moreItems = [
  { href: "/shots", label: "Shots", icon: Database },
  { href: "/courses", label: "Courses", icon: MapPinned },
  { href: "/handicap", label: "Handicap", icon: Calculator },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/achievements", label: "Achievements", icon: Award },
];

const xpFormatter = new Intl.NumberFormat("en-GB");

export function AppNav({ totalXp }: { totalXp: number }) {
  const pathname = usePathname();
  const level = calculateUserLevel(totalXp);
  const xpToNextLevel = Math.max(0, level.nextLevelXp - totalXp);

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

          <div className="hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto lg:flex">
            {navGroups.map((group) => (
              <div key={group.label} className="flex items-center gap-1 rounded-xl border border-white/50 bg-white/35 p-1">
                <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.isActive(pathname);

                  return (
                    <Button
                      key={item.href}
                      asChild
                      variant={active ? "default" : "ghost"}
                      className={
                        active
                          ? "h-9 shrink-0 rounded-xl bg-[#111827] px-3 text-white shadow-sm hover:bg-[#111827] hover:text-white"
                          : "h-9 shrink-0 rounded-xl px-3 text-muted-foreground hover:bg-white hover:text-foreground"
                      }
                    >
                      <Link href={item.href} prefetch={false} aria-current={active ? "page" : undefined}>
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            ))}
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

          <Button asChild className="ml-auto hidden h-9 shrink-0 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 sm:inline-flex">
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
