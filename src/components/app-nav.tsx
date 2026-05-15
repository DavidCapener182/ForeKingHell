"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Award,
  Brain,
  Calculator,
  CalendarDays,
  Cable,
  ChevronDown,
  CreditCard,
  Database,
  Flag,
  Gauge,
  Gift,
  GitCompareArrows,
  LineChart,
  LogOut,
  MapPinned,
  MoreHorizontal,
  Radio,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trophy,
  Upload,
  UserRound,
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
      {
        href: "/today",
        label: "Today",
        icon: CalendarDays,
        isActive: (pathname: string) => pathname.startsWith("/today"),
      },
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: Gauge,
        isActive: (pathname: string) =>
          pathname === "/" || pathname === "/dashboard",
      },
      {
        href: "/progress",
        label: "Progress",
        icon: LineChart,
        isActive: (pathname: string) => pathname.startsWith("/progress"),
      },
      {
        href: "/strokes-gained",
        label: "Strokes gained",
        icon: LineChart,
        isActive: (pathname: string) => pathname.startsWith("/strokes-gained"),
      },
    ],
  },
  {
    label: "Play",
    items: [
      {
        href: "/rounds",
        label: "Rounds",
        icon: Flag,
        isActive: (pathname: string) => pathname.startsWith("/rounds"),
      },
      {
        href: "/courses",
        label: "Courses",
        icon: MapPinned,
        isActive: (pathname: string) => pathname.startsWith("/courses"),
      },
      {
        href: "/handicap",
        label: "Handicap",
        icon: Calculator,
        isActive: (pathname: string) => pathname.startsWith("/handicap"),
      },
    ],
  },
  {
    label: "Analyse",
    items: [
      {
        href: "/compare",
        label: "Compare",
        icon: GitCompareArrows,
        isActive: (pathname: string) => pathname.startsWith("/compare"),
      },
      {
        href: "/bag",
        label: "Bag",
        icon: Target,
        isActive: (pathname: string) => pathname.startsWith("/bag"),
      },
      {
        href: "/equipment",
        label: "Equipment",
        icon: Wrench,
        isActive: (pathname: string) => pathname.startsWith("/equipment"),
      },
      {
        href: "/shots",
        label: "Shots",
        icon: Database,
        isActive: (pathname: string) => pathname.startsWith("/shots"),
      },
      {
        href: "/rapsodo",
        label: "Rapsodo",
        icon: Upload,
        isActive: (pathname: string) => pathname.startsWith("/rapsodo"),
      },
    ],
  },
  {
    label: "Social",
    items: [
      {
        href: "/feed",
        label: "Feed",
        icon: Radio,
        isActive: (pathname: string) => pathname.startsWith("/feed"),
      },
      {
        href: "/friends",
        label: "Friends",
        icon: Users,
        isActive: (pathname: string) => pathname.startsWith("/friends"),
      },
      {
        href: "/groups",
        label: "Groups",
        icon: Users,
        isActive: (pathname: string) => pathname.startsWith("/groups"),
      },
      {
        href: "/challenges",
        label: "Challenges",
        icon: Trophy,
        isActive: (pathname: string) => pathname.startsWith("/challenges"),
      },
      {
        href: "/leaderboard",
        label: "Leaderboards",
        icon: Users,
        isActive: (pathname: string) => pathname.startsWith("/leaderboard"),
      },
      {
        href: "/profile",
        label: "Profile",
        icon: UserRound,
        isActive: (pathname: string) => pathname.startsWith("/profile"),
      },
      {
        href: "/social-intelligence",
        label: "Recaps & safety",
        icon: ShieldAlert,
        isActive: (pathname: string) => pathname.startsWith("/social-intelligence"),
      },
    ],
  },
  {
    label: "Improve",
    items: [
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
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        isActive: (pathname: string) => pathname.startsWith("/settings"),
      },
    ],
  },
  {
    label: "Platform",
    items: [
      {
        href: "/billing",
        label: "Billing",
        icon: CreditCard,
        isActive: (pathname: string) => pathname.startsWith("/billing"),
      },
      {
        href: "/providers",
        label: "Providers",
        icon: Cable,
        isActive: (pathname: string) => pathname.startsWith("/providers"),
      },
    ],
  },
];

const partnerNavItem = {
  href: "/partners",
  label: "Partners",
  icon: Gift,
  isActive: (pathname: string) => pathname.startsWith("/partners"),
};

const adminNavItem = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheck,
  isActive: (pathname: string) => pathname.startsWith("/admin"),
};

const mobilePrimaryItems = [
  {
    href: "/today",
    label: "Today",
    icon: CalendarDays,
    isActive: (pathname: string) =>
      pathname === "/" || pathname.startsWith("/today"),
  },
  {
    href: "/import",
    label: "Import",
    icon: Upload,
    isActive: (pathname: string) => pathname.startsWith("/import"),
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
    href: "/coach",
    label: "Coach",
    icon: Brain,
    isActive: (pathname: string) => pathname.startsWith("/coach"),
  },
];

const mobileMoreGroups = [
  {
    label: "Play",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Gauge },
      { href: "/courses", label: "Courses", icon: MapPinned },
      { href: "/handicap", label: "Handicap", icon: Calculator },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/compare", label: "Compare", icon: GitCompareArrows },
      { href: "/equipment", label: "Equipment", icon: Wrench },
      { href: "/rapsodo", label: "Rapsodo", icon: Upload },
      { href: "/shots", label: "Shots", icon: Database },
      { href: "/strokes-gained", label: "Strokes gained", icon: LineChart },
      { href: "/progress", label: "Progress", icon: LineChart },
      { href: "/achievements", label: "Achievements", icon: Award },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/feed", label: "Feed", icon: Radio },
      { href: "/friends", label: "Friends", icon: Users },
      { href: "/groups", label: "Groups", icon: Users },
      { href: "/challenges", label: "Challenges", icon: Trophy },
      { href: "/leaderboard", label: "Leaderboards", icon: Users },
      { href: "/profile", label: "Profile", icon: UserRound },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/providers", label: "Providers", icon: Cable },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/social-intelligence", label: "Recaps & safety", icon: ShieldAlert },
    ],
  },
];

const adminMoreItem = { href: "/admin", label: "Admin", icon: ShieldCheck };

const xpFormatter = new Intl.NumberFormat("en-GB");

export function AppNav({ totalXp, isAdmin = false }: { totalXp: number; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [moreQuery, setMoreQuery] = useState("");
  const level = calculateUserLevel(totalXp);
  const xpToNextLevel = Math.max(0, level.nextLevelXp - totalXp);
  const desktopNavGroups = useMemo(
    () =>
      navGroups.map((group) => {
        if (group.label !== "Platform") {
          return group;
        }

        return {
          ...group,
          items: isAdmin ? [...group.items, partnerNavItem, adminNavItem] : group.items,
        };
      }),
    [isAdmin],
  );
  const visibleMoreGroups = useMemo(() => {
    const adminGroup = isAdmin
      ? [
          {
            label: "Admin",
            items: [
              { href: "/partners", label: "Partners", icon: Gift },
              adminMoreItem,
            ],
          },
        ]
      : [];
    const query = moreQuery.trim().toLowerCase();

    return [...mobileMoreGroups, ...adminGroup]
      .map((group) => ({
        ...group,
        items: query ? group.items.filter((item) => item.label.toLowerCase().includes(query)) : group.items,
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdmin, moreQuery]);

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
      <div className="sticky top-0 z-40 px-2 pt-2 sm:px-6 sm:pt-4 lg:px-8">
        <nav
          aria-label="Primary"
          className="glass-toolbar mx-auto flex w-full max-w-7xl items-center gap-2 rounded-xl p-1.5 sm:rounded-2xl sm:p-2"
        >
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold sm:px-2.5 sm:py-2"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#111827] text-white sm:size-8">
              <Flag className="size-3.5 sm:size-4" />
            </span>
            <span className="hidden truncate sm:inline">ForeKingHell</span>
            <span className="truncate sm:hidden">FKH</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-visible lg:flex">
            {desktopNavGroups.map((group) => {
              const items = group.items;
              const groupActive = items.some((item) =>
                item.isActive(pathname),
              );
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
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active = item.isActive(pathname);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          aria-current={active ? "page" : undefined}
                          className={
                            active
                              ? "flex items-center gap-2 rounded-xl bg-[#111827] px-3 py-2 text-sm font-semibold text-white"
                              : "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                          }
                        >
                          <Icon
                            className={
                              active
                                ? "size-4 text-emerald-300"
                                : "size-4 text-muted-foreground"
                            }
                          />
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
                  className={
                    active
                      ? "h-9 rounded-xl bg-[#111827] text-white"
                      : "h-9 rounded-xl"
                  }
                >
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </div>

          <Button
            asChild
            className="ml-auto hidden h-9 shrink-0 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 sm:inline-flex"
          >
            <Link href="/import">
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>

          <Link
            href="/achievements"
            aria-label={`Level ${level.level}, ${xpFormatter.format(totalXp)} XP, ${xpFormatter.format(xpToNextLevel)} XP to next level`}
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-2.5 text-sm font-medium text-white shadow-sm sm:ml-0 sm:h-9 sm:px-3"
          >
            <Zap className="size-4 text-emerald-300" />
            <span>Lvl {level.level}</span>
          </Link>
          <form
            action="/auth/sign-out"
            method="post"
            className="hidden sm:block"
          >
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </nav>
      </div>

      <nav
        aria-label="Mobile primary"
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 sm:hidden"
      >
        <div className="glass-toolbar grid grid-cols-6 gap-1 rounded-2xl p-1.5">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
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
            <div className="absolute bottom-full right-0 mb-2 grid max-h-[70vh] min-w-72 gap-3 overflow-y-auto rounded-2xl border bg-white p-3 shadow-xl">
              <input
                value={moreQuery}
                onChange={(event) => setMoreQuery(event.target.value)}
                placeholder="Search menu"
                className="h-9 rounded-xl border bg-slate-50 px-3 text-sm"
              />
              {visibleMoreGroups.map((group) => (
                <div key={group.label} className="grid gap-1">
                  <p className="px-1 text-xs font-semibold uppercase text-muted-foreground">{group.label}</p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        <Icon className="size-4 text-muted-foreground" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </details>
        </div>
      </nav>
    </>
  );
}
