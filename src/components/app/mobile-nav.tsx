"use client";

import Link from "next/link";
import { Menu, Upload, X, Zap } from "lucide-react";

import {
  buildDesktopNavGroups,
  mobilePrimaryItems,
  type AppNavGroup,
} from "@/components/app/nav-items";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  const profileInitials = getProfileInitials(profileLabel);
  const groups = buildDesktopNavGroups(isAdmin);

  return (
    <>
      <input
        id="mobile-navigation-toggle"
        type="checkbox"
        className="mobile-navigation-toggle sr-only"
        aria-hidden="true"
      />
      <div className="fixed inset-x-0 top-0 z-[60] h-[calc(3.5rem+env(safe-area-inset-top))] border-b border-border bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:hidden">
        <div className="relative flex h-14 items-center">
          <label
            htmlFor="mobile-navigation-toggle"
            role="button"
            tabIndex={0}
            className="mobile-navigation-trigger relative z-10 grid size-10 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-controls="mobile-navigation-drawer"
            aria-label="Toggle navigation"
          >
            <Menu className="mobile-navigation-open-icon size-5" />
            <X className="mobile-navigation-close-icon hidden size-5" />
          </label>

          <Link
            href="/dashboard"
            aria-label="ForeKingHell dashboard"
            className="absolute inset-y-0 left-1/2 z-0 flex max-w-[12rem] -translate-x-1/2 translate-y-1.5 items-center justify-center truncate text-center text-[1.05rem] font-semibold leading-none tracking-normal text-foreground"
          >
            ForeKingHell
          </Link>

          <Button asChild variant="secondary" className="relative z-10 ml-auto h-10 rounded-full px-3">
            <Link
              href="/achievements"
              aria-label={`Level ${level}, ${xpFormatter.format(totalXp)} XP, ${xpFormatter.format(xpToNextLevel)} XP to next level`}
              prefetch={false}
            >
              <Zap className="size-4 text-emerald-600" />
              <span>Lvl {level}</span>
            </Link>
          </Button>
        </div>
      </div>

      <div className="mobile-navigation-panel fixed inset-0 z-[100] hidden sm:hidden">
        <label
          htmlFor="mobile-navigation-toggle"
          aria-label="Close navigation"
          className="absolute inset-0 cursor-pointer bg-black/20"
        />
        <aside
          id="mobile-navigation-drawer"
          aria-label="Navigation menu"
          className="absolute inset-y-0 left-0 flex w-[20rem] max-w-[calc(100vw-2rem)] flex-col border-r border-border bg-popover text-popover-foreground shadow-xl"
        >
          <header className="border-b border-border p-4 pl-16 text-left">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar size="lg">
                {profile?.avatarUrl ? (
                  <ProfileAvatarImage src={profile.avatarUrl} />
                ) : (
                  <AvatarFallback>{profileInitials}</AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">ForeKingHell</p>
                <p className="truncate text-sm text-muted-foreground">{profileLabel}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <Badge variant="secondary">Lvl {level}</Badge>
              <Badge variant="outline">{xpFormatter.format(totalXp)} XP</Badge>
              {isAdmin ? <Badge>Admin</Badge> : null}
            </div>
          </header>
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-4 p-3">
              {groups.map((group) => (
                <MobileNavGroup
                  key={group.label}
                  group={group}
                  pathname={pathname}
                />
              ))}
            </div>
          </ScrollArea>
          <div className="mt-auto grid gap-2 border-t border-border p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button asChild className="justify-start">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import CSV
              </Link>
            </Button>
            <form action="/auth/sign-out" method="post">
              <Button type="submit" variant="outline" className="w-full justify-start">
                Sign out
              </Button>
            </form>
          </div>
        </aside>
      </div>

      <nav
        aria-label="Mobile primary"
        className="fixed inset-x-0 bottom-0 z-40 sm:hidden"
      >
        <div className="grid grid-cols-5 border-t border-border bg-background/96 px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_22px_rgba(15,23,42,0.08)] backdrop-blur">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                prefetch={false}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] transition-colors",
                  active
                    ? "bg-primary/8 font-semibold text-primary"
                    : "font-medium text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function MobileNavGroup({
  group,
  pathname,
}: {
  group: AppNavGroup;
  pathname: string;
}) {
  return (
    <section className="grid gap-1">
      <div className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {group.label}
      </div>
      <div className="grid gap-1">
        {group.items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              prefetch={false}
              className={cn(
                "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted",
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

  return initials || "FK";
}

function ProfileAvatarImage({ src }: { src: string }) {
  if (src.startsWith("data:image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="aspect-square size-full rounded-full object-cover" />;
  }

  return <AvatarImage src={src} alt="" />;
}
