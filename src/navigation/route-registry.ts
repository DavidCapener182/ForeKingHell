import type { LucideIcon } from "lucide-react";

import {
  adminNavGroup,
  mobileMoreGroups,
  mobilePrimaryItems,
  navGroups,
  type AppNavGroup,
  type AppNavItem,
} from "@/components/app/nav-items";

export type ProductArea = "today" | "play" | "analyse" | "improve" | "compete" | "account";

export type MobileVisibility = "primary" | "secondary" | "hidden";

export type ProductRoute = {
  id: string;
  href: string;
  label: string;
  area: ProductArea;
  mobileVisibility: MobileVisibility;
  entitlement?: string;
  admin: boolean;
  searchKeywords: string[];
  icon: LucideIcon;
  badge?: string;
  isActive: (pathname: string) => boolean;
};

const areaByGroupLabel: Record<string, ProductArea> = {
  Home: "today",
  Play: "play",
  Analyse: "analyse",
  Improve: "improve",
  Compete: "compete",
  Social: "account",
  Account: "account",
  Admin: "account",
};

const primaryMobileHrefs = new Set(
  mobilePrimaryItems.filter((item) => item.href.startsWith("/")).map((item) => item.href),
);
const secondaryMobileHrefs = new Set(
  mobileMoreGroups.flatMap((group) => group.items.map((item) => item.href)),
);

function routeId(href: string) {
  return href.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "root";
}

function mobileVisibility(href: string): MobileVisibility {
  if (primaryMobileHrefs.has(href)) return "primary";
  if (secondaryMobileHrefs.has(href)) return "secondary";
  return "hidden";
}

function routeFromItem(item: AppNavItem, groupLabel: string, admin: boolean): ProductRoute {
  const area = areaByGroupLabel[groupLabel];

  if (!area) {
    throw new Error(`Navigation group ${groupLabel} does not map to a product area.`);
  }

  return {
    id: routeId(item.href),
    href: item.href,
    label: item.label,
    area,
    mobileVisibility: admin ? "hidden" : mobileVisibility(item.href),
    admin,
    searchKeywords: Array.from(
      new Set(
        [item.label, groupLabel, area, item.badge, ...item.href.split("/").filter(Boolean)].filter(
          (keyword): keyword is string => Boolean(keyword),
        ),
      ),
    ),
    icon: item.icon,
    badge: item.badge,
    isActive: item.isActive,
  };
}

function routesFromGroups(groups: AppNavGroup[], admin = false) {
  return groups.flatMap((group) =>
    group.items.map((item) => routeFromItem(item, group.label, admin)),
  );
}

function buildRouteRegistry() {
  const routesByHref = new Map<string, ProductRoute>();
  const candidates = [
    ...routesFromGroups(navGroups),
    ...routesFromGroups(mobileMoreGroups),
    ...routesFromGroups([adminNavGroup], true),
  ];

  for (const route of candidates) {
    if (!routesByHref.has(route.href)) {
      routesByHref.set(route.href, route);
    }
  }

  return Array.from(routesByHref.values());
}

export const productRouteRegistry: readonly ProductRoute[] = buildRouteRegistry();

export function commandRoutes(isAdmin: boolean) {
  return productRouteRegistry.filter((route) => isAdmin || !route.admin);
}

export function findProductRoute(pathname: string) {
  return productRouteRegistry
    .filter((route) => route.isActive(pathname))
    .sort((left, right) => right.href.length - left.href.length)[0];
}

export function productAreaLabel(area: ProductArea) {
  if (area === "today") return "Home";
  return `${area.charAt(0).toUpperCase()}${area.slice(1)}`;
}
