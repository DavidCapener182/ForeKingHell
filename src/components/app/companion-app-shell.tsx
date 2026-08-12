"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { MobileNav, type MobileNavProfile } from "@/components/app/mobile-nav";
import { CompanionRouteProgress } from "@/components/app/companion-route-progress";
import {
  isMobileCompanionHeroRoute,
  isMobileImmersiveRoute,
} from "@/components/app/route-metadata";
import { calculateUserLevel } from "@/lib/achievements/xp";
import { cn } from "@/lib/utils";

export function CompanionAppShell({
  children,
  totalXp,
  profile = null,
}: {
  children: ReactNode;
  totalXp: number;
  profile?: MobileNavProfile;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const immersive = isMobileImmersiveRoute(pathname);
  const heroRoute = isMobileCompanionHeroRoute(pathname);
  const level = calculateUserLevel(totalXp);

  useEffect(() => {
    document.body.dataset.mobilePlatform = "apple";
    return () => {
      delete document.body.dataset.mobilePlatform;
    };
  }, []);

  useEffect(() => {
    if (!immersive) {
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
  }, [immersive]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const href of ["/today", "/practice", "/play", "/sessions", "/import"]) {
        router.prefetch(href);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div
      data-mobile-platform="apple"
      data-app-surface="companion"
      data-mobile-immersive-shell={immersive ? "course-twin" : undefined}
      data-companion-hero-shell={heroRoute ? "true" : undefined}
      className={cn(
        "relative flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip bg-background",
        immersive || heroRoute ? "pt-0" : "pt-[calc(3.25rem+env(safe-area-inset-top))]",
      )}
    >
      <a
        href="#main-content"
        className="sr-only fixed left-3 top-3 z-[100] rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-2 ring-ring focus:not-sr-only"
      >
        Skip to content
      </a>
      {immersive ? null : (
        <MobileNav pathname={pathname} totalXp={totalXp} level={level.level} profile={profile} />
      )}
      <CompanionRouteProgress />
      {children}
    </div>
  );
}
