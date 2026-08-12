"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  LogOut,
  PanelLeftIcon,
  Rows3,
  Search,
  Settings,
  Upload,
  UserRound,
  Zap,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { AppSurfaceLink } from "@/components/app/app-surface-link";
import { DesktopWorkbenchChrome } from "@/components/app/desktop-workbench-chrome";
import {
  GlobalCommandCentre,
  openGlobalCommandCentre,
} from "@/components/app/global-command-centre";
import type { MobileNavProfile } from "@/components/app/mobile-nav";
import { buildDesktopNavGroups } from "@/components/app/nav-items";
import { isMobileImmersiveRoute } from "@/components/app/route-metadata";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { purgePrivateClientData } from "@/lib/service-worker-cache";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import type { AppSurface } from "@/lib/app-surface";
import { BRAND_NAME } from "@/lib/brand";
import { getProfileInitials } from "@/lib/profile-initials";
import { cn } from "@/lib/utils";

type WorkbenchAppShellProps = {
  children: ReactNode;
  totalXp: number;
  isAdmin?: boolean;
  profile?: MobileNavProfile;
  surface: AppSurface;
};

const xpFormatter = new Intl.NumberFormat("en-GB");
const sidebarDensityStorageKey = "fkh:desktop-sidebar-density";

type SidebarDensity = "comfortable" | "compact" | "icon";
type ExpandedSidebarDensity = Exclude<SidebarDensity, "icon">;

const MobileNav = dynamic(() =>
  import("@/components/app/mobile-nav").then((module) => module.MobileNav),
);

export function WorkbenchAppShell({
  children,
  totalXp,
  isAdmin = false,
  profile = null,
  surface,
}: WorkbenchAppShellProps) {
  const pathname = usePathname();
  const isMobileImmersive = isMobileImmersiveRoute(pathname);
  const level = calculateUserLevel(totalXp);
  const xpToNextLevel = Math.max(0, level.nextLevelXp - totalXp);
  const desktopNavGroups = useMemo(() => buildDesktopNavGroups(isAdmin), [isAdmin]);
  const [sidebarDensity, setSidebarDensity] = useState<SidebarDensity>("comfortable");
  const [lastExpandedDensity, setLastExpandedDensity] =
    useState<ExpandedSidebarDensity>("comfortable");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedDensity = window.localStorage.getItem(sidebarDensityStorageKey);

      if (
        storedDensity === "compact" ||
        storedDensity === "comfortable" ||
        storedDensity === "icon"
      ) {
        setSidebarDensity(storedDensity);
        if (storedDensity !== "icon") {
          setLastExpandedDensity(storedDensity);
        }
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isMobileImmersive) {
      delete document.documentElement.dataset.mobileImmersive;
      delete document.body.dataset.mobileImmersive;
      return;
    }

    document.documentElement.dataset.mobileImmersive = "course-twin";
    document.body.dataset.mobileImmersive = "course-twin";

    return () => {
      delete document.documentElement.dataset.mobileImmersive;
      delete document.body.dataset.mobileImmersive;
    };
  }, [isMobileImmersive]);

  useEffect(() => {
    function handleTableKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableTableTarget(event.target)) {
        return;
      }

      const activeRow = findFocusedWorkbenchRow(event.target);

      if (!activeRow) {
        return;
      }

      if (event.key === "Enter" || event.key === " " || event.code === "Space") {
        event.preventDefault();
        activeRow.click();
        return;
      }

      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }

      const row = nextWorkbenchRow(activeRow, event.key);

      if (!row || row === activeRow) {
        return;
      }

      event.preventDefault();
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    window.addEventListener("keydown", handleTableKeyDown);

    return () => window.removeEventListener("keydown", handleTableKeyDown);
  }, []);

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  function updateSidebarDensity(nextDensity: SidebarDensity) {
    setSidebarDensity(nextDensity);

    if (nextDensity !== "icon") {
      setLastExpandedDensity(nextDensity);
    }

    window.localStorage.setItem(sidebarDensityStorageKey, nextDensity);
  }

  function handleSidebarOpenChange(open: boolean) {
    updateSidebarDensity(open ? lastExpandedDensity : "icon");
  }

  const isCompactSidebar = sidebarDensity === "compact";
  const sidebarStyle = {
    "--sidebar-width": isCompactSidebar ? "13.75rem" : "16rem",
  } as CSSProperties;

  return (
    <SidebarProvider
      open={sidebarDensity !== "icon"}
      onOpenChange={handleSidebarOpenChange}
      style={sidebarStyle}
      data-sidebar-density={sidebarDensity}
    >
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[100] rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-2 ring-ring focus:not-sr-only"
      >
        Skip to content
      </a>
      {surface === "workbench" ? (
        <>
          <a
            href="#app-sidebar"
            className="sr-only fixed left-3 top-14 z-[100] rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-2 ring-ring focus:not-sr-only"
          >
            Skip to sidebar
          </a>
          <MainTableSkipLink pathname={pathname} />
        </>
      ) : null}
      {surface === "workbench" ? (
        <Sidebar
          id="app-sidebar"
          tabIndex={-1}
          collapsible="icon"
          className="border-sidebar-border bg-sidebar"
        >
          <SidebarHeader
            className={cn(
              "border-b border-sidebar-border bg-sidebar text-sidebar-foreground",
              isCompactSidebar && "gap-1 p-1.5",
            )}
          >
            <div className={cn("flex items-center gap-2 px-1 py-1", isCompactSidebar && "py-0.5")}>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip="Dashboard"
                className="text-sidebar-foreground hover:text-sidebar-accent-foreground"
              >
                <Link href="/dashboard" prefetch={false}>
                  <BrandMark
                    className={cn("size-9 rounded-lg shadow-sm", isCompactSidebar && "size-8")}
                    sizes={isCompactSidebar ? "32px" : "36px"}
                  />
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate font-semibold">{BRAND_NAME}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      Golf analytics
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
              <SidebarTrigger className="ml-auto hidden size-8 text-sidebar-foreground hover:text-sidebar-accent-foreground sm:inline-flex" />
            </div>
          </SidebarHeader>

          <SidebarContent>
            <div className="px-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={openGlobalCommandCentre}
                className="hidden min-h-10 w-full justify-between lg:flex"
                aria-label="Search LM World Tour, Command K"
              >
                <span className="flex items-center gap-2">
                  <Search className="size-4" /> Search
                </span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
            </div>
            {desktopNavGroups.map((group) => (
              <SidebarGroup key={group.label} className={cn(isCompactSidebar && "p-1")}>
                <SidebarGroupLabel className={cn(isCompactSidebar && "h-6 px-1.5 text-[11px]")}>
                  {group.label}
                </SidebarGroupLabel>
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
                              isCompactSidebar && "h-7 gap-1.5 px-1.5 text-xs",
                              active &&
                                "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary shadow-[inset_0_0_0_1px_rgba(7,95,54,0.08)]",
                            )}
                          >
                            <Link
                              href={item.href}
                              prefetch={false}
                              aria-current={active ? "page" : undefined}
                            >
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
          <SidebarFooter
            className={cn(
              "border-t border-sidebar-border bg-sidebar text-sidebar-foreground",
              isCompactSidebar && "gap-1 p-1.5",
            )}
          >
            <SidebarDensityMenu density={sidebarDensity} onDensityChange={updateSidebarDensity} />
            <Button
              asChild
              className={cn(
                "premium-action w-full justify-start rounded-lg",
                isCompactSidebar && "h-8 px-2 text-xs",
              )}
            >
              <Link href="/import" prefetch={false}>
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
              compact={isCompactSidebar}
            />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
      ) : null}

      <div
        data-app-surface={surface}
        data-mobile-immersive-shell={isMobileImmersive ? "course-twin" : undefined}
        className={cn(
          "relative flex min-w-0 flex-1 flex-col bg-background",
          surface === "workbench" ? "overflow-x-auto pt-0" : "overflow-x-clip",
          isMobileImmersive || surface === "workbench"
            ? "pt-0"
            : "pt-[calc(3.25rem+env(safe-area-inset-top))]",
        )}
      >
        {isMobileImmersive || surface !== "companion" ? null : (
          <MobileNav pathname={pathname} totalXp={totalXp} level={level.level} profile={profile} />
        )}
        {surface === "workbench" ? (
          <DesktopWorkbenchChrome
            navGroups={desktopNavGroups}
            isAdmin={isAdmin}
            accountMenu={
              <ProfileDropdown
                totalXp={totalXp}
                level={level.level}
                xpToNextLevel={xpToNextLevel}
                profile={profile}
                isAdmin={isAdmin}
                surface="topbar"
              />
            }
          />
        ) : null}
        {surface === "workbench" && !isMobileImmersive ? (
          <AppSurfaceLink
            href="/surface/companion?next=%2Ftoday"
            data-phone-companion-return
            className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 hidden min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#071a11]/92 px-4 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl max-md:inline-flex"
          >
            <PanelLeftIcon className="size-4" aria-hidden />
            Return to companion
          </AppSurfaceLink>
        ) : null}
        {children}
        {surface === "workbench" ? (
          <GlobalCommandCentre isAdmin={isAdmin} enableKeyboardShortcut={false} />
        ) : null}
      </div>
    </SidebarProvider>
  );
}

function MainTableSkipLink({ pathname }: { pathname: string }) {
  const [hasMainTable, setHasMainTable] = useState(false);

  useEffect(() => {
    const findMainTable = () => Boolean(resolveMainTableTarget());
    let observer: MutationObserver | null = null;
    let initialTimer: number | null = null;
    let fallbackTimer: number | null = null;

    const syncMainTable = () => {
      const nextHasMainTable = findMainTable();
      setHasMainTable(nextHasMainTable);

      if (nextHasMainTable) {
        observer?.disconnect();
        observer = null;
        if (fallbackTimer !== null) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
      }
    };

    initialTimer = window.setTimeout(() => {
      setHasMainTable(false);
      observer = new MutationObserver(syncMainTable);
      observer.observe(document.body, { childList: true, subtree: true });
      syncMainTable();

      if (!findMainTable()) {
        fallbackTimer = window.setTimeout(syncMainTable, 2_500);
      }
    }, 0);

    return () => {
      observer?.disconnect();
      if (initialTimer !== null) {
        window.clearTimeout(initialTimer);
      }
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
      }
    };
  }, [pathname]);

  if (!hasMainTable) {
    return null;
  }

  return (
    <button
      type="button"
      className="sr-only fixed left-3 top-24 z-[100] rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-2 ring-ring focus:not-sr-only max-sm:hidden"
      onClick={() => {
        const target = resolveMainTableTarget();
        focusMainTableTarget(target);
      }}
    >
      Skip to main table
    </button>
  );
}

function focusMainTableTarget(target: HTMLElement | null) {
  if (!target) {
    return;
  }

  if (!target.hasAttribute("tabindex")) {
    target.tabIndex = -1;
  }

  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

function resolveMainTableTarget() {
  const explicitTarget = document.querySelector<HTMLElement>("[data-main-table-target='true']");

  if (explicitTarget) {
    return explicitTarget;
  }

  const exportTable = document.querySelector<HTMLElement>("table[data-workbench-export-table]");

  return (
    exportTable?.closest<HTMLElement>("[data-slot='table-container'], [role='region']") ??
    exportTable ??
    null
  );
}

function isEditableTableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.closest("button,a,input,textarea,select,[role='button'],[role='menuitem']") !== null
  );
}

function findFocusedWorkbenchRow(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const row = target.closest<HTMLTableRowElement>("tr[tabindex]");

  if (!row) {
    return null;
  }

  return row.closest("table[data-workbench-export-table]") ? row : null;
}

function nextWorkbenchRow(activeRow: HTMLTableRowElement, key: string) {
  const table = activeRow.closest("table[data-workbench-export-table]");

  if (!table) {
    return null;
  }

  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr[tabindex]")).filter(
    (row) => !row.hasAttribute("disabled") && row.offsetParent !== null,
  );
  const currentIndex = rows.indexOf(activeRow);

  if (currentIndex === -1) {
    return null;
  }

  if (key === "Home") {
    return rows[0] ?? null;
  }

  if (key === "End") {
    return rows[rows.length - 1] ?? null;
  }

  if (key === "ArrowDown") {
    return rows[Math.min(rows.length - 1, currentIndex + 1)] ?? null;
  }

  if (key === "ArrowUp") {
    return rows[Math.max(0, currentIndex - 1)] ?? null;
  }

  return null;
}

function SidebarDensityMenu({
  density,
  onDensityChange,
}: {
  density: SidebarDensity;
  onDensityChange: (density: SidebarDensity) => void;
}) {
  const densityLabel =
    density === "compact" ? "Compact" : density === "icon" ? "Icon-only" : "Comfortable";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start rounded-lg border-sidebar-border bg-sidebar-accent px-2 text-sidebar-accent-foreground hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          aria-label={`Sidebar density: ${densityLabel}`}
        >
          {density === "icon" ? (
            <PanelLeftIcon className="size-4" aria-hidden />
          ) : (
            <Rows3 className="size-4" aria-hidden />
          )}
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Sidebar: {densityLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel>Sidebar density</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={density}
          onValueChange={(value) => {
            if (value === "comfortable" || value === "compact" || value === "icon") {
              onDensityChange(value);
            }
          }}
        >
          <DropdownMenuRadioItem value="comfortable">
            <span className="grid">
              <span className="font-medium">Comfortable</span>
              <span className="text-xs text-muted-foreground">Full labels and spacing</span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">
            <span className="grid">
              <span className="font-medium">Compact</span>
              <span className="text-xs text-muted-foreground">Tighter route switching</span>
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="icon">
            <span className="grid">
              <span className="font-medium">Icon-only</span>
              <span className="text-xs text-muted-foreground">Maximum workspace width</span>
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileDropdown({
  totalXp,
  level,
  xpToNextLevel,
  profile,
  isAdmin,
  compact = false,
  surface = "sidebar",
}: {
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  profile: MobileNavProfile;
  isAdmin: boolean;
  compact?: boolean;
  surface?: "sidebar" | "topbar";
}) {
  const profileLabel = profile?.displayName || profile?.username || "Profile";
  const profileInitials = getProfileInitials(profileLabel);
  const isTopbar = surface === "topbar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={isTopbar ? "outline" : "ghost"}
          className={cn(
            isTopbar
              ? "focus-aaa h-9 w-auto shrink-0 justify-start gap-2 rounded-lg border-emerald-950/10 bg-white/76 px-2 shadow-sm outline-none hover:border-emerald-300 hover:bg-white"
              : "h-auto w-full justify-start gap-2 border border-sidebar-border bg-sidebar-accent px-2 py-2 text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            compact && "gap-1.5 py-1.5",
          )}
          aria-label={isTopbar ? "Open desktop account menu" : "Open account menu"}
        >
          <Avatar size={isTopbar ? "sm" : "default"}>
            {profile?.avatarUrl ? (
              <ProfileDropdownAvatarImage src={profile.avatarUrl} />
            ) : (
              <AvatarFallback>{profileInitials}</AvatarFallback>
            )}
          </Avatar>
          <span
            className={cn(
              "min-w-0 flex-1 text-left",
              isTopbar ? "hidden 2xl:grid" : "grid group-data-[collapsible=icon]:hidden",
            )}
          >
            <span className="truncate text-sm font-medium">{profileLabel}</span>
            <span
              className={cn(
                "truncate text-xs",
                isTopbar ? "text-muted-foreground" : "text-sidebar-foreground/70",
              )}
            >
              {isTopbar ? `Level ${level}` : `Level ${level} · ${xpFormatter.format(totalXp)} XP`}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={isTopbar ? "bottom" : "right"} align="end" className="w-64">
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
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <AppSurfaceLink href="/surface/companion?next=%2Ftoday">
            <PanelLeftIcon className="size-4" />
            Open companion app
          </AppSurfaceLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/billing">
            <CreditCard className="size-4" />
            Billing
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
        <form action="/auth/sign-out" method="post" onSubmit={clearPrivateDataBeforeSignOut}>
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

async function clearPrivateDataBeforeSignOut(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget;
  await purgePrivateClientData();
  form.submit();
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
