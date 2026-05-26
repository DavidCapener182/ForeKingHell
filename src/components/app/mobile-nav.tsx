"use client";

import Link from "next/link";
import { Menu, Upload, Zap } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import {
  buildDesktopNavGroups,
  mobilePrimaryItems,
  type AppNavGroup,
} from "@/components/app/nav-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[60] h-[calc(3.25rem+env(safe-area-inset-top))] border-b border-border bg-white/98 px-4 pt-[env(safe-area-inset-top)] sm:hidden">
        <div className="relative flex h-[3.25rem] items-center">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative z-10 size-10 rounded-full"
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="z-[70] w-[20rem] max-w-[calc(100vw-2rem)] gap-0 p-0"
            >
              <SheetHeader className="border-b border-border p-4 text-left">
                <div className="flex items-center gap-3">
                  <BrandMark className="size-12 rounded-md" sizes="48px" />
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{BRAND_NAME}</SheetTitle>
                    <SheetDescription className="truncate">{profileLabel}</SheetDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="secondary">Lvl {level}</Badge>
                  <Badge variant="outline">{xpFormatter.format(totalXp)} XP</Badge>
                  {isAdmin ? <Badge>Admin</Badge> : null}
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100dvh-12rem)]">
                <div className="grid gap-4 p-3">
                  {groups.map((group) => (
                    <MobileNavGroup key={group.label} group={group} pathname={pathname} />
                  ))}
                </div>
              </ScrollArea>
              <div className="mt-auto grid gap-2 border-t border-border p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Button asChild className="justify-start">
                  <SheetClose asChild>
                    <Link href="/import">
                      <Upload className="size-4" />
                      Import data
                    </Link>
                  </SheetClose>
                </Button>
                <form action="/auth/sign-out" method="post">
                  <Button type="submit" variant="outline" className="w-full justify-start">
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
            <BrandMark className="size-8 rounded-md" sizes="32px" />
            <span className="truncate">{BRAND_NAME}</span>
          </Link>

          <Button
            asChild
            variant="secondary"
            className="relative z-10 ml-auto h-9 rounded-full px-3"
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
      </div>

      <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <div className="grid grid-cols-5 border-t border-border bg-white/98 px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_22px_rgba(15,23,42,0.08)]">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] transition-colors",
                  active
                    ? "font-semibold text-primary"
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

function MobileNavGroup({ group, pathname }: { group: AppNavGroup; pathname: string }) {
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
            <SheetClose key={item.href} asChild>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
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
