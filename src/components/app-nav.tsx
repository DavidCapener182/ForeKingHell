"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
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

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { calculateUserLevel } from "@/lib/achievements/xp";
import { BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/brand";

const navGroups = [
  {
    label: "Overview",
    items: [
      {
        href: "/today",
        label: "Latest practice",
        icon: CalendarDays,
        isActive: (pathname: string) => pathname.startsWith("/today"),
      },
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: Gauge,
        isActive: (pathname: string) => pathname === "/" || pathname === "/dashboard",
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
        href: "/course-records",
        label: "Records",
        icon: Trophy,
        isActive: (pathname: string) => pathname.startsWith("/course-records"),
      },
      {
        href: "/tournaments",
        label: "Tournaments",
        icon: CalendarDays,
        isActive: (pathname: string) => pathname.startsWith("/tournaments"),
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
        label: "Recaps & Safety",
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
    href: "/dashboard",
    label: "Dashboard",
    icon: Gauge,
    isActive: (pathname: string) =>
      pathname === "/" ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/today") ||
      pathname.startsWith("/progress") ||
      pathname.startsWith("/strokes-gained"),
  },
  {
    href: "/rounds",
    label: "Play",
    icon: Flag,
    isActive: (pathname: string) =>
      pathname.startsWith("/rounds") ||
      pathname.startsWith("/courses") ||
      pathname.startsWith("/course-records") ||
      pathname.startsWith("/tournaments") ||
      pathname.startsWith("/handicap"),
  },
  {
    href: "/bag",
    label: "Analyse",
    icon: Target,
    isActive: (pathname: string) =>
      pathname.startsWith("/bag") ||
      pathname.startsWith("/shots") ||
      pathname.startsWith("/compare") ||
      pathname.startsWith("/equipment") ||
      pathname.startsWith("/rapsodo"),
  },
  {
    href: "/coach",
    label: "Improve",
    icon: Brain,
    isActive: (pathname: string) =>
      pathname.startsWith("/coach") ||
      pathname.startsWith("/achievements") ||
      pathname.startsWith("/settings"),
  },
  {
    href: "/feed",
    label: "Social",
    icon: Radio,
    isActive: (pathname: string) =>
      pathname.startsWith("/feed") ||
      pathname.startsWith("/friends") ||
      pathname.startsWith("/groups") ||
      pathname.startsWith("/challenges") ||
      pathname.startsWith("/leaderboard") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/social-intelligence"),
  },
];

const xpFormatter = new Intl.NumberFormat("en-GB");

type MobileNavProfile = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
} | null;

type AppNavProps = {
  totalXp: number;
  isAdmin?: boolean;
  profile?: MobileNavProfile;
};

function getProfileInitials(label: string) {
  const initials = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "FK";
}

export function AppNav({ totalXp, isAdmin = false, profile = null }: AppNavProps) {
  const pathname = usePathname();
  const level = calculateUserLevel(totalXp);
  const xpToNextLevel = Math.max(0, level.nextLevelXp - totalXp);
  const profileLabel = profile?.displayName || profile?.username || "Profile";
  const profileInitials = getProfileInitials(profileLabel);
  const profileAvatarStyle = profile?.avatarUrl
    ? { backgroundImage: `url(${profile.avatarUrl})` }
    : undefined;
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
      <div className="sticky top-0 z-40 hidden border-b border-[#E5E7EB] bg-white sm:block">
        <nav
          aria-label="Primary"
          className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-6 lg:px-8"
        >
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-2 pr-4 text-sm font-semibold"
          >
            <BrandMark className="size-8 rounded-md" sizes="32px" />
            <span className="hidden truncate sm:inline">{BRAND_NAME}</span>
            <span className="truncate sm:hidden">{BRAND_SHORT_NAME}</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-visible lg:flex">
            {desktopNavGroups.map((group) => {
              const items = group.items;
              const groupActive = items.some((item) => item.isActive(pathname));
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
                        ? "relative h-14 rounded-none bg-transparent px-2 text-[#050505] shadow-none hover:bg-transparent hover:text-[#050505] focus-visible:bg-transparent focus-visible:text-[#050505] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[#0B7A3B]"
                        : "h-14 rounded-none px-2 text-muted-foreground hover:bg-transparent hover:text-[#050505] focus-visible:bg-transparent focus-visible:text-[#050505] group-hover/desktop-nav:text-[#050505] group-focus-within/desktop-nav:text-[#050505]"
                    }
                  >
                    {group.label}
                    <ChevronDown className="size-4 transition-transform group-hover/desktop-nav:rotate-180 group-focus-within/desktop-nav:rotate-180" />
                  </Button>

                  <div
                    id={menuId}
                    role="menu"
                    className="pointer-events-none invisible absolute left-0 top-full z-50 grid min-w-56 translate-y-0 gap-1 border border-[#E5E7EB] bg-white p-2 opacity-0 shadow-[0_12px_28px_rgba(15,23,42,0.08)] transition duration-150 group-hover/desktop-nav:pointer-events-auto group-hover/desktop-nav:visible group-hover/desktop-nav:opacity-100 group-focus-within/desktop-nav:pointer-events-auto group-focus-within/desktop-nav:visible group-focus-within/desktop-nav:opacity-100"
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
                              ? "flex items-center gap-2 rounded-md bg-[#F5F6F4] px-3 py-2 text-sm font-semibold text-[#0B7A3B]"
                              : "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-[#F5F6F4]"
                          }
                        >
                          <Icon
                            className={
                              active ? "size-4 text-[#0B7A3B]" : "size-4 text-muted-foreground"
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
                      ? "h-14 rounded-none bg-transparent text-[#0B7A3B] shadow-none"
                      : "h-14 rounded-none"
                  }
                >
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </div>

          <Button
            asChild
            className="ml-auto hidden h-9 shrink-0 rounded-md bg-[#0B7A3B] text-white hover:bg-[#064E3B] sm:inline-flex"
          >
            <Link href="/import">
              <Upload className="size-4" />
              Import data
            </Link>
          </Button>

          <Link
            href="/achievements"
            aria-label={`Level ${level.level}, ${xpFormatter.format(totalXp)} XP, ${xpFormatter.format(xpToNextLevel)} XP to next level`}
            className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#050505] px-3 text-sm font-medium text-white sm:ml-0"
          >
            <Zap className="size-4 text-emerald-300" />
            <span>Lvl {level.level}</span>
          </Link>
          <form action="/auth/sign-out" method="post" className="hidden sm:block">
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-md"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </form>
        </nav>
      </div>

      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[calc(3.25rem+env(safe-area-inset-top))] border-b border-[#E5E7EB] bg-white px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:hidden">
        <Link
          href="/profile"
          aria-label={`Open ${profileLabel} profile`}
          className="pointer-events-auto absolute left-4 top-[calc(0.75rem+env(safe-area-inset-top))] grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[#E5E7EB] bg-[#111827] bg-cover bg-center text-xs font-semibold uppercase text-white shadow-sm"
          style={profileAvatarStyle}
        >
          {profile?.avatarUrl ? <span className="sr-only">{profileLabel}</span> : profileInitials}
        </Link>
        <Link
          href="/dashboard"
          aria-label={`${BRAND_NAME} dashboard`}
          className="pointer-events-auto absolute left-1/2 top-[calc(0.75rem+env(safe-area-inset-top))] flex max-w-[12rem] -translate-x-1/2 items-center gap-2 truncate px-3 text-center text-[1.05rem] font-semibold tracking-normal text-[#050505]"
        >
          <BrandMark className="size-10 rounded-md" sizes="40px" />
          <span className="truncate">{BRAND_NAME}</span>
        </Link>
        <Link
          href="/achievements"
          aria-label={`Level ${level.level}, ${xpFormatter.format(totalXp)} XP, ${xpFormatter.format(xpToNextLevel)} XP to next level`}
          className="pointer-events-auto absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#111827] px-3 text-sm font-semibold text-white shadow-sm"
        >
          <Zap className="size-4 text-emerald-300" />
          <span>Lvl {level.level}</span>
        </Link>
      </div>

      <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-50 sm:hidden">
        <div className="grid grid-cols-5 border-t border-[#E5E7EB] bg-white px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_22px_rgba(15,23,42,0.08)]">
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
                    ? "flex flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold text-[#0B7A3B]"
                    : "flex flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium text-[#6B7280]"
                }
              >
                <span className="grid size-7 place-items-center">
                  <Icon className="size-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
