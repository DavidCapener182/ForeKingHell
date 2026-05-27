"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Upload, UserRound, Zap } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { MobileNav, type MobileNavProfile, getProfileInitials } from "@/components/app/mobile-nav";
import { buildDesktopNavGroups } from "@/components/app/nav-items";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { purgePrivateServiceWorkerCaches } from "@/lib/service-worker-cache";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { calculateUserLevel } from "@/lib/achievements/xp";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  totalXp: number;
  isAdmin?: boolean;
  profile?: MobileNavProfile;
};

const xpFormatter = new Intl.NumberFormat("en-GB");

export function AppShell({ children, totalXp, isAdmin = false, profile = null }: AppShellProps) {
  const pathname = usePathname();
  const level = calculateUserLevel(totalXp);
  const xpToNextLevel = Math.max(0, level.nextLevelXp - totalXp);
  const desktopNavGroups = useMemo(() => buildDesktopNavGroups(isAdmin), [isAdmin]);

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[100] rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-2 ring-ring focus:not-sr-only"
      >
        Skip to content
      </a>
      <Sidebar collapsible="icon" className="border-sidebar-border bg-sidebar">
        <SidebarHeader className="border-b border-sidebar-border bg-[#FFFDF8]">
          <div className="flex items-center gap-2 px-1 py-1">
            <SidebarMenuButton asChild size="lg" tooltip="Dashboard">
              <Link href="/dashboard">
                <BrandMark className="size-9 rounded-md" sizes="36px" />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">{BRAND_NAME}</span>
                  <span className="truncate text-xs text-muted-foreground">Golf analytics</span>
                </span>
              </Link>
            </SidebarMenuButton>
            <SidebarTrigger className="ml-auto hidden size-8 sm:inline-flex" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          {desktopNavGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.isActive(pathname);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className={cn(
                            active &&
                              "bg-primary/8 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                          )}
                        >
                          <Link href={item.href} aria-current={active ? "page" : undefined}>
                            <Icon className="size-4" aria-hidden />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        {item.badge ? (
                          <SidebarMenuBadge>
                            <Badge
                              variant={item.badge === "Admin" ? "default" : "secondary"}
                              className="h-5 px-1.5 text-[10px]"
                            >
                              {item.badge}
                            </Badge>
                          </SidebarMenuBadge>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarSeparator />
        <SidebarFooter className="border-t border-sidebar-border bg-[#FFFDF8]">
          <Button asChild className="w-full justify-start">
            <Link href="/import">
              <Upload className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">Import data</span>
            </Link>
          </Button>
          <ProfileDropdown
            totalXp={totalXp}
            level={level.level}
            xpToNextLevel={xpToNextLevel}
            profile={profile}
            isAdmin={isAdmin}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
        <MobileNav
          pathname={pathname}
          totalXp={totalXp}
          level={level.level}
          xpToNextLevel={xpToNextLevel}
          profile={profile}
          isAdmin={isAdmin}
        />
        {children}
      </div>
    </SidebarProvider>
  );
}

function ProfileDropdown({
  totalXp,
  level,
  xpToNextLevel,
  profile,
  isAdmin,
}: {
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  profile: MobileNavProfile;
  isAdmin: boolean;
}) {
  const profileLabel = profile?.displayName || profile?.username || "Profile";
  const profileInitials = getProfileInitials(profileLabel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start gap-2 px-2 py-2"
          aria-label="Open account menu"
        >
          <Avatar>
            {profile?.avatarUrl ? (
              <ProfileDropdownAvatarImage src={profile.avatarUrl} />
            ) : (
              <AvatarFallback>{profileInitials}</AvatarFallback>
            )}
          </Avatar>
          <span className="grid min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">{profileLabel}</span>
            <span className="truncate text-xs text-muted-foreground">
              Level {level} · {xpFormatter.format(totalXp)} XP
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="grid gap-1">
            <span className="truncate text-sm text-foreground">{profileLabel}</span>
            <span>{xpFormatter.format(xpToNextLevel)} XP to next level</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/achievements">
            <Zap className="size-4" />
            Achievements
            <Badge variant="secondary" className="ml-auto">
              Lvl {level}
            </Badge>
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              Admin
              <Badge className="ml-auto">Admin</Badge>
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form
          action="/auth/sign-out"
          method="post"
          onSubmit={() => purgePrivateServiceWorkerCaches()}
        >
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full">
              <LogOut className="size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileDropdownAvatarImage({ src }: { src: string }) {
  if (src.startsWith("data:image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="aspect-square size-full rounded-full object-cover" />;
  }

  return <AvatarImage src={src} alt="" />;
}

function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/share/") ||
    pathname.startsWith("/privacy")
  );
}
