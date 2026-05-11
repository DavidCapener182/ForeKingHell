"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  Brain,
  Calculator,
  ChevronDown,
  Database,
  Flag,
  Gauge,
  LineChart,
  MapPinned,
  Target,
  Upload,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { calculateUserLevel } from "@/lib/achievements/xp";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: Gauge,
    isActive: (pathname: string) => pathname === "/" || pathname === "/dashboard",
  },
  {
    href: "/import",
    label: "Import",
    icon: Upload,
    isActive: (pathname: string) => pathname.startsWith("/import"),
  },
  {
    href: "/shots",
    label: "Shots",
    icon: Database,
    isActive: (pathname: string) => pathname.startsWith("/shots"),
  },
  {
    href: "/bag",
    label: "Bag",
    icon: Target,
    isActive: (pathname: string) => pathname.startsWith("/bag"),
  },
  {
    href: "/rounds",
    label: "Rounds",
    icon: Flag,
    isActive: (pathname: string) => pathname.startsWith("/rounds"),
  },
  {
    href: "/handicap",
    label: "Handicap",
    icon: Calculator,
    isActive: (pathname: string) => pathname.startsWith("/handicap"),
  },
  {
    href: "/courses",
    label: "Courses",
    icon: MapPinned,
    isActive: (pathname: string) => pathname.startsWith("/courses"),
  },
  {
    href: "/progress",
    label: "Progress",
    icon: LineChart,
    isActive: (pathname: string) => pathname.startsWith("/progress"),
  },
  {
    href: "/coach",
    label: "Coach",
    icon: Brain,
    isActive: (pathname: string) => pathname.startsWith("/coach"),
  },
  {
    href: "/achievements",
    label: "Achievements",
    icon: Award,
    isActive: (pathname: string) => pathname.startsWith("/achievements"),
  },
];

const xpFormatter = new Intl.NumberFormat("en-GB");

export function AppNav({ totalXp }: { totalXp: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const level = calculateUserLevel(totalXp);
  const xpToNextLevel = Math.max(0, level.nextLevelXp - totalXp);
  const activeItem = navItems.find((item) => item.isActive(pathname)) ?? navItems[0];
  const ActiveIcon = activeItem.icon;

  return (
    <div className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <nav
        aria-label="Primary"
        className="glass-toolbar mx-auto flex w-full max-w-7xl flex-col gap-2 rounded-xl p-2 sm:flex-row sm:items-center sm:rounded-2xl"
      >
        <div className="flex w-full items-center gap-2 sm:hidden">
          <Link
            href="/dashboard"
            prefetch={false}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#111827] text-white">
              <Flag className="size-4" />
            </span>
            <span className="truncate">ForeKingHell</span>
          </Link>
          <Link
            href="/achievements"
            prefetch={false}
            aria-label={`Level ${level.level}, ${xpFormatter.format(totalXp)} XP, ${xpFormatter.format(
              xpToNextLevel,
            )} XP to next level`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-3 text-sm font-medium text-white shadow-sm"
          >
            <Zap className="size-4 text-emerald-300" />
            <span>Lvl {level.level}</span>
          </Link>
        </div>

        <div className="relative w-full sm:hidden">
          <ActiveIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            aria-label="Primary navigation"
            value={activeItem.href}
            onChange={(event) => router.push(event.target.value)}
            className="h-10 w-full appearance-none rounded-xl border border-border bg-white pl-9 pr-10 text-sm font-medium text-foreground shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
          >
            {navItems.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <Link
          href="/dashboard"
          prefetch={false}
          className="mr-1 hidden items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold sm:flex"
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#111827] text-white">
            <Flag className="size-4" />
          </span>
          <span>ForeKingHell</span>
        </Link>

        <div className="hidden min-w-0 flex-1 gap-1 overflow-x-auto sm:flex">
          {navItems.map((item) => {
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
        <Button
          asChild
          variant="outline"
          className="hidden h-9 shrink-0 rounded-xl border-0 bg-[#111827] px-3 text-white shadow-sm hover:bg-[#1f2937] hover:text-white 2xl:inline-flex"
        >
          <Link
            href="/achievements"
            prefetch={false}
            aria-label={`Level ${level.level}, ${xpFormatter.format(totalXp)} XP, ${xpFormatter.format(
              xpToNextLevel,
            )} XP to next level`}
          >
            <Zap className="size-4 text-emerald-300" />
            <span>Lvl {level.level}</span>
            <span className="text-white/50">/</span>
            <span>{xpFormatter.format(totalXp)} XP</span>
            <span className="hidden text-white/50 lg:inline">/</span>
            <span className="hidden lg:inline">{xpFormatter.format(xpToNextLevel)} to next</span>
          </Link>
        </Button>
      </nav>
    </div>
  );
}
