"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, MoreHorizontal, Search, Upload, UserRound, X } from "lucide-react";

import { CompanionBrandLockup } from "@/components/app/companion-brand";
import {
  mobileMoreGroups,
  mobilePageTitle,
  mobilePrimaryItems,
  type AppNavGroup,
} from "@/components/app/nav-items";
import { AppSurfaceLink } from "@/components/app/app-surface-link";
import { AppEmptyState } from "@/components/app/app-empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { purgePrivateClientData } from "@/lib/service-worker-cache";
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
import { cn } from "@/lib/utils";
import { isMobileCompanionHeroRoute, mobileBackNavigation } from "@/components/app/route-metadata";

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
};

const xpFormatter = new Intl.NumberFormat("en-GB");
const mobileScrollStoragePrefix = "fkh:mobile-tab-scroll:";

export function MobileNav({ pathname, totalXp, level, profile }: MobileNavProps) {
  const profileLabel = profile?.displayName || profile?.username || "Profile";
  const pageTitle = mobilePageTitle(pathname);
  const heroRoute = isMobileCompanionHeroRoute(pathname);
  const backNavigation = useMemo(() => mobileBackNavigation(pathname), [pathname]);
  const groups = mobileMoreGroups;
  const [query, setQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const moreCloseRef = useRef<HTMLButtonElement>(null);
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

      const heroHeight = document
        .querySelector<HTMLElement>("[data-companion-image-hero]")
        ?.getBoundingClientRect().height;
      const compactTitleThreshold = heroRoute && heroHeight ? Math.max(44, heroHeight - 52) : 44;

      setCompactTitleVisible(scrollY >= compactTitleThreshold);

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
  }, [backNavigation, heroRoute, tabScrollStorageKey]);

  return (
    <>
      <header
        aria-label="Mobile app bar"
        data-companion-hero-header={heroRoute ? "true" : undefined}
        data-hero-collapsed={compactTitleVisible ? "true" : "false"}
        className="ios-app-header fixed left-0 top-0 z-[60] h-[calc(3.25rem+env(safe-area-inset-top))] w-dvw max-w-full px-3 pt-[env(safe-area-inset-top)]"
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
                  aria-label={`Open profile and navigation for ${profileLabel}`}
                >
                  <UserRound className="size-5" aria-hidden />
                </Button>
              </SheetTrigger>
            )}
            <SheetContent
              side="bottom"
              showCloseButton={false}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                moreCloseRef.current?.focus({ preventScroll: true });
              }}
              className="ios-navigation-sheet z-[70] gap-0 p-0"
            >
              <span className="ios-sheet-handle" aria-hidden />
              <SheetHeader className="ios-sheet-header border-b px-4 pb-3 pt-2 text-left">
                <div className="min-w-0 pr-10">
                  <SheetTitle className="text-[1.375rem] font-bold tracking-tight">
                    Profile &amp; tools
                  </SheetTitle>
                  <SheetDescription className="mt-0.5 truncate">
                    {profileLabel} · Level {level} · {xpFormatter.format(totalXp)} XP
                  </SheetDescription>
                </div>
                <SheetClose asChild>
                  <Button
                    ref={moreCloseRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ios-nav-button focus-aaa absolute right-3 top-3 size-11"
                    aria-label="Close navigation"
                  >
                    <X className="size-5" aria-hidden />
                  </Button>
                </SheetClose>
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
                    placeholder="Search companion actions"
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
                    <AppEmptyState
                      title="No matching pages"
                      description="Clear the search to see every companion destination."
                      primaryAction={
                        <Button type="button" size="sm" onClick={() => setQuery("")}>
                          Clear search
                        </Button>
                      }
                      className="p-4"
                    />
                  )}
                </div>
              </ScrollArea>
              <div className="ios-sheet-footer mt-auto grid gap-3 border-t px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                <Button asChild variant="outline" className="min-h-12 justify-start">
                  <SheetClose asChild>
                    <AppSurfaceLink
                      href={`/surface/workbench?next=${encodeURIComponent(pathname)}`}
                    >
                      <Search className="size-4" />
                      Open full desktop site
                    </AppSurfaceLink>
                  </SheetClose>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 w-full justify-start"
                    >
                      Sign out
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sign out of LM World Tour?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Private offline golf data will be cleared from this device before the
                        session ends.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Stay signed in</AlertDialogCancel>
                      <form
                        action="/auth/sign-out"
                        method="post"
                        onSubmit={clearPrivateDataBeforeSignOut}
                      >
                        <AlertDialogAction type="submit" variant="destructive">
                          Sign out
                        </AlertDialogAction>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </SheetContent>
          </Sheet>

          <div className="relative grid min-w-0 place-items-center">
            <CompanionBrandLockup
              className={cn(
                "absolute transition-opacity duration-150 motion-reduce:transition-none",
                compactTitleVisible ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            />
            <p
              className={cn(
                "ios-inline-title min-w-0 truncate text-center transition-opacity duration-150 motion-reduce:transition-none",
                compactTitleVisible ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              data-mobile-route-label
              data-compact-title-visible={compactTitleVisible ? "true" : "false"}
            >
              {pageTitle}
            </p>
          </div>

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

      <nav aria-label="Mobile primary" className="fixed bottom-0 left-0 z-40 w-dvw max-w-full">
        <div className="ios-tab-bar grid grid-cols-5 px-1 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                prefetch
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
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{group.label}</p>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
          {mobileGroupDescription(group.label)}
        </p>
      </div>
      <Separator />
      <div className="grid sm:grid-cols-2">
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);

          return (
            <SheetClose key={`${group.label}-${item.label}-${item.href}`} asChild>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="focus-aaa outline-none"
              >
                <Item
                  variant={active ? "muted" : "default"}
                  size="sm"
                  className="min-h-12 rounded-none border-x-0 border-t-0 last:border-b-0"
                >
                  <ItemMedia>
                    <Icon className="size-4" aria-hidden />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.label}</ItemTitle>
                  </ItemContent>
                  {item.badge ? (
                    <ItemActions>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.badge}
                      </Badge>
                    </ItemActions>
                  ) : null}
                </Item>
              </Link>
            </SheetClose>
          );
        })}
      </div>
    </section>
  );
}

function mobileGroupDescription(label: string) {
  if (label === "Golf") return "Bag numbers, goals and import";
  if (label === "Compete") return "Current challenges, tournaments and achievements";
  if (label === "Account") return "Profile, notifications and preferences";
  return "More ForeKingHell tools";
}
