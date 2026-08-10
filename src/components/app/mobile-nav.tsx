"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";

import {
  adminNavGroup,
  mobileMoreGroups,
  mobilePageTitle,
  mobilePrimaryItems,
  type AppNavGroup,
} from "@/components/app/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { purgePrivateClientData } from "@/lib/service-worker-cache";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { openGlobalCommandCentre } from "@/components/app/global-command-centre";
import { mobileBackNavigation } from "@/components/app/route-metadata";

export type MobileNavProfile = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
} | null;

type MobileNavProps = {
  pathname: string;
  totalXp: number;
  level: number;
  profile: MobileNavProfile;
  isAdmin: boolean;
};

const xpFormatter = new Intl.NumberFormat("en-GB");
const mobileScrollStoragePrefix = "fkh:mobile-tab-scroll:";

export function MobileNav({ pathname, totalXp, level, profile, isAdmin }: MobileNavProps) {
  const profileLabel = profile?.displayName || profile?.username || "Profile";
  const pageTitle = mobilePageTitle(pathname);
  const backNavigation = useMemo(() => mobileBackNavigation(pathname), [pathname]);
  const groups = useMemo(
    () => (isAdmin ? [...mobileMoreGroups, adminNavGroup] : mobileMoreGroups),
    [isAdmin],
  );
  const [query, setQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const scrollFrameRef = useRef<number | null>(null);
  const activePrimaryHref =
    mobilePrimaryItems.find((item) => item.isActive(pathname))?.href ?? pathname;
  const tabScrollStorageKey = `${mobileScrollStoragePrefix}${
    backNavigation ? `detail:${pathname}` : activePrimaryHref
  }`;
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

  useEffect(() => {
    let restoreFrame: number | null = null;

    const readStoredScroll = () => {
      try {
        const storedValue = window.sessionStorage.getItem(tabScrollStorageKey);
        const storedScroll = storedValue ? Number.parseFloat(storedValue) : 0;
        return Number.isFinite(storedScroll) && storedScroll > 0 ? storedScroll : 0;
      } catch {
        return 0;
      }
    };

    const rememberCurrentScroll = () => {
      const scrollY = Math.max(0, window.scrollY);

      setCompactTitleVisible(scrollY >= 44);

      try {
        window.sessionStorage.setItem(tabScrollStorageKey, String(scrollY));
      } catch {
        // Private browsing and strict storage policies can disable session storage.
      }
    };

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        rememberCurrentScroll();
      });
    };

    const storedScroll = readStoredScroll();
    restoreFrame = window.requestAnimationFrame(() => {
      restoreFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: storedScroll, behavior: "auto" });
        rememberCurrentScroll();
      });
    });

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (restoreFrame !== null) {
        window.cancelAnimationFrame(restoreFrame);
      }
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [backNavigation, tabScrollStorageKey]);

  return (
    <>
      <header
        aria-label="Mobile app bar"
        className="ios-app-header fixed left-0 top-0 z-[60] h-[calc(3.25rem+env(safe-area-inset-top))] w-dvw max-w-full px-3 pt-[env(safe-area-inset-top)] lg:hidden"
      >
        <div className="grid h-[3.25rem] grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            {backNavigation ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="ios-nav-button focus-aaa relative z-10 size-11"
              >
                <Link href={backNavigation.href} aria-label={`Back to ${backNavigation.label}`}>
                  <ArrowLeft className="size-5" aria-hidden />
                </Link>
              </Button>
            ) : (
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ios-nav-button focus-aaa relative z-10 size-11"
                  aria-label="Open navigation"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
            )}
            <SheetContent side="bottom" className="ios-navigation-sheet z-[70] gap-0 p-0">
              <span className="ios-sheet-handle" aria-hidden />
              <SheetHeader className="ios-sheet-header border-b px-4 pb-3 pt-2 text-left">
                <div className="min-w-0 pr-10">
                  <SheetTitle className="text-[1.375rem] font-bold tracking-tight">More</SheetTitle>
                  <SheetDescription className="mt-0.5 truncate">
                    {profileLabel} · Level {level} · {xpFormatter.format(totalXp)} XP
                    {isAdmin ? " · Admin" : ""}
                  </SheetDescription>
                </div>
                <label className="relative mt-2 block">
                  <span className="sr-only">Search navigation</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search analysis, sessions or settings"
                    className="ios-sheet-search focus-aaa min-h-11 w-full py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground"
                  />
                </label>
              </SheetHeader>
              <ScrollArea className="min-h-0 flex-1">
                <div className="grid gap-5 px-4 py-4">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((group) => (
                      <MobileNavGroup key={group.label} group={group} pathname={pathname} />
                    ))
                  ) : (
                    <div className="ios-drawer-group p-4 text-sm text-muted-foreground">
                      No matching pages.
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="ios-sheet-footer mt-auto grid gap-3 border-t px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                <div className="ios-drawer-group grid grid-cols-3 divide-x divide-border">
                  <SheetClose asChild>
                    <Link
                      href="/profile"
                      className="focus-aaa grid min-h-14 place-items-center gap-1 px-2 py-2 text-center text-[11px] font-medium text-foreground"
                    >
                      <UserRound className="size-4" aria-hidden />
                      Profile
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/settings"
                      className="focus-aaa grid min-h-14 place-items-center gap-1 px-2 py-2 text-center text-[11px] font-medium text-foreground"
                    >
                      <Settings className="size-4" aria-hidden />
                      Settings
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/privacy"
                      className="focus-aaa grid min-h-14 place-items-center gap-1 px-2 py-2 text-center text-[11px] font-medium text-foreground"
                    >
                      <ShieldCheck className="size-4" aria-hidden />
                      Privacy
                    </Link>
                  </SheetClose>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 justify-start"
                  onClick={() => {
                    setMoreOpen(false);
                    window.setTimeout(openGlobalCommandCentre, 0);
                  }}
                >
                  <Search className="size-4" />
                  Search all tools
                </Button>
                <Button asChild className="min-h-11 justify-center rounded-xl">
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
                  onSubmit={clearPrivateDataBeforeSignOut}
                >
                  <Button type="submit" variant="outline" className="min-h-11 w-full justify-start">
                    Sign out
                  </Button>
                </form>
              </div>
            </SheetContent>
          </Sheet>

          <p
            className={cn(
              "ios-inline-title min-w-0 truncate text-center transition-opacity duration-150 motion-reduce:transition-none",
              compactTitleVisible ? "opacity-100" : "opacity-0",
            )}
            data-mobile-route-label
            data-compact-title-visible={compactTitleVisible ? "true" : "false"}
          >
            {pageTitle}
          </p>

          {backNavigation ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ios-nav-button focus-aaa size-11 justify-self-end"
              aria-label="Open more navigation"
              aria-haspopup="dialog"
              onClick={() => setMoreOpen(true)}
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </Button>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="ios-nav-button focus-aaa size-11 justify-self-end"
            >
              <Link href="/import" aria-label="Import launch-monitor data">
                <Upload className="size-5" />
                <span className="sr-only">Import</span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      <nav
        aria-label="Mobile primary"
        className="fixed bottom-0 left-0 z-40 w-dvw max-w-full lg:hidden"
      >
        <div className="ios-tab-bar grid grid-cols-5 px-1 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            if (item.label === "More") {
              return (
                <button
                  key={`${item.label}-${item.href}`}
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  aria-current={active ? "page" : undefined}
                  aria-label="Open more navigation"
                  className={cn(
                    "ios-tab-item focus-aaa flex min-h-14 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 outline-none transition-[color,transform] duration-100 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                    active ? "font-semibold" : "",
                  )}
                >
                  <span className="ios-tab-icon grid place-items-center">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "ios-tab-item focus-aaa flex min-h-14 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 outline-none transition-[color,transform] duration-100 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                  active ? "font-semibold" : "",
                )}
              >
                <span className="ios-tab-icon grid place-items-center">
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

async function clearPrivateDataBeforeSignOut(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget;
  await purgePrivateClientData();
  form.submit();
}

function MobileNavGroup({ group, pathname }: { group: AppNavGroup; pathname: string }) {
  return (
    <section className="ios-drawer-group overflow-hidden border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/70 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{group.label}</p>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
          {mobileGroupDescription(group.label)}
        </p>
      </div>
      <div className="grid sm:grid-cols-2">
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);

          return (
            <SheetClose key={`${group.label}-${item.label}-${item.href}`} asChild>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "ios-drawer-link focus-aaa grid min-h-12 touch-manipulation grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 text-[15px] font-normal outline-none transition-colors duration-100 ease-out last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0",
                  active ? "font-medium" : "text-foreground",
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
    </section>
  );
}

function mobileGroupDescription(label: string) {
  if (label === "Home") return "Dashboard and account overview";
  if (label === "Play") return "Rounds, courses and import";
  if (label === "Analyse") return "Shots, bag, comparisons and progress";
  if (label === "Improve") return "Coaching, practice and speed";
  if (label === "Compete") return "Challenges, tournaments and records";
  if (label === "Social") return "Friends, groups and activity";
  if (label === "Account") return "Profile, providers, billing and settings";
  if (label === "Admin") return "System, users and operations";
  return "More ForeKingHell tools";
}
