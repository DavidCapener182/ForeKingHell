"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Menu, Search, Settings, ShieldCheck, Upload, UserRound, Zap } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import {
  buildDesktopNavGroups,
  mobilePrimaryItems,
  type AppNavGroup,
} from "@/components/app/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { purgePrivateServiceWorkerCaches } from "@/lib/service-worker-cache";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type MobileNavProfile = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
} | null;

type MobileNavProps = {
  pathname: string;
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  profile: MobileNavProfile;
  isAdmin: boolean;
};

const xpFormatter = new Intl.NumberFormat("en-GB");

export function MobileNav({
  pathname,
  totalXp,
  level,
  xpToNextLevel,
  profile,
  isAdmin,
}: MobileNavProps) {
  const profileLabel = profile?.displayName || profile?.username || "Profile";
  const groups = buildDesktopNavGroups(isAdmin);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${group.label} ${item.label} ${item.href}`.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedQuery]);

  return (
    <>
      <header
        aria-label="Mobile app bar"
        className="premium-mobile-bar fixed left-0 top-0 z-[60] h-[calc(3.25rem+env(safe-area-inset-top))] w-dvw max-w-full border-b px-4 pt-[env(safe-area-inset-top)] sm:hidden"
      >
        <div className="relative flex h-[3.25rem] items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="focus-aaa relative z-10 size-11 rounded-lg border border-emerald-900/10 bg-white/75 shadow-sm"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="z-[70] w-[20rem] max-w-[calc(100vw-2rem)] gap-0 border-r border-emerald-950/15 bg-[linear-gradient(180deg,#fffdf4,#f2f6ee)] p-0"
            >
              <SheetHeader className="border-b border-border/80 p-4 text-left">
                <div className="flex items-center gap-3">
                  <BrandMark className="size-12 rounded-lg shadow-sm" sizes="48px" />
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{BRAND_NAME}</SheetTitle>
                    <SheetDescription className="truncate">{profileLabel}</SheetDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge className="bg-emerald-900 text-white hover:bg-emerald-900">
                    Lvl {level}
                  </Badge>
                  <Badge variant="outline" className="bg-white/70">
                    {xpFormatter.format(totalXp)} XP
                  </Badge>
                  {isAdmin ? <Badge>Admin</Badge> : null}
                </div>
                <label className="relative mt-3 block">
                  <span className="sr-only">Search navigation</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search pages, clubs, rounds or friends"
                    className="focus-aaa min-h-11 w-full rounded-lg border border-input bg-white/88 py-2.5 pl-9 pr-3 text-sm font-medium text-foreground shadow-sm outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </SheetHeader>
              <ScrollArea className="min-h-0 flex-1">
                <div className="grid gap-4 p-3">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((group) => (
                      <MobileNavGroup key={group.label} group={group} pathname={pathname} />
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-white/70 p-3 text-sm text-muted-foreground">
                      No matching pages.
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="mt-auto grid gap-2 border-t border-border/80 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="grid grid-cols-3 gap-2">
                  <SheetClose asChild>
                    <Link
                      href="/profile"
                      className="focus-aaa grid min-h-11 place-items-center gap-1 rounded-lg border border-border bg-white/70 px-2 py-2 text-center text-[11px] font-semibold text-foreground"
                    >
                      <UserRound className="size-4" aria-hidden />
                      Profile
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/settings"
                      className="focus-aaa grid min-h-11 place-items-center gap-1 rounded-lg border border-border bg-white/70 px-2 py-2 text-center text-[11px] font-semibold text-foreground"
                    >
                      <Settings className="size-4" aria-hidden />
                      Settings
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/privacy"
                      className="focus-aaa grid min-h-11 place-items-center gap-1 rounded-lg border border-border bg-white/70 px-2 py-2 text-center text-[11px] font-semibold text-foreground"
                    >
                      <ShieldCheck className="size-4" aria-hidden />
                      Privacy
                    </Link>
                  </SheetClose>
                </div>
                <Button asChild className="premium-action min-h-11 justify-start rounded-lg">
                  <SheetClose asChild>
                    <Link href="/import">
                      <Upload className="size-4" />
                      Import data
                    </Link>
                  </SheetClose>
                </Button>
                <form
                  action="/auth/sign-out"
                  method="post"
                  onSubmit={() => purgePrivateServiceWorkerCaches()}
                >
                  <Button type="submit" variant="outline" className="min-h-11 w-full justify-start">
                    Sign out
                  </Button>
                </form>
              </div>
            </SheetContent>
          </Sheet>

          <Link
            href="/dashboard"
            aria-label={`${BRAND_NAME} dashboard`}
            className="absolute inset-y-0 left-1/2 z-0 flex max-w-[12rem] -translate-x-1/2 translate-y-1 items-center justify-center gap-2 truncate text-center text-[1.02rem] font-semibold leading-none tracking-normal text-foreground"
          >
            <BrandMark className="size-8 rounded-lg shadow-sm" sizes="32px" />
            <span className="truncate">{BRAND_NAME}</span>
          </Link>

          <Button
            asChild
            variant="secondary"
            className="focus-aaa relative z-10 ml-auto h-11 rounded-lg border border-emerald-900/10 bg-white/70 px-3 text-emerald-950 shadow-sm hover:bg-white"
          >
            <Link
              href="/achievements"
              aria-label={`Level ${level}, ${xpFormatter.format(totalXp)} XP, ${xpFormatter.format(xpToNextLevel)} XP to next level`}
            >
              <Zap className="size-4 text-emerald-600" />
              <span>Lvl {level}</span>
            </Link>
          </Button>
        </div>
      </header>

      <nav
        aria-label="Mobile primary"
        className="fixed bottom-0 left-0 z-40 w-dvw max-w-full sm:hidden"
      >
        <div className="premium-mobile-bar grid grid-cols-5 border-t px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-1.5">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-aaa flex min-h-12 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] outline-none transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]",
                  active
                    ? "mobile-nav-primary-active font-semibold"
                    : "font-medium text-muted-foreground hover:bg-white/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-md",
                    active ? "mobile-nav-primary-icon-active" : "",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function MobileNavGroup({ group, pathname }: { group: AppNavGroup; pathname: string }) {
  return (
    <section className="grid gap-1">
      <div className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {group.label}
      </div>
      <div className="grid gap-1">
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);

          return (
            <SheetClose key={`${group.label}-${item.label}-${item.href}`} asChild>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-aaa grid min-h-11 touch-manipulation grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 text-sm font-medium outline-none transition-colors duration-150 ease-out",
                  active ? "mobile-nav-drawer-active" : "text-foreground hover:bg-white/70",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            </SheetClose>
          );
        })}
      </div>
      <Separator className="mt-2 last:hidden" />
    </section>
  );
}

export function getProfileInitials(label: string) {
  const initials = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "LM";
}
