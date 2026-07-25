import type { LucideIcon } from "lucide-react";

import {
  appRouteMetadata,
  findRouteMetadata,
  routesAvailableTo,
} from "@/components/app/route-metadata";

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

const areaByNavigationGroup: Record<
  (typeof appRouteMetadata)[number]["navigationGroup"],
  ProductArea
> = {
  Home: "today",
  Play: "play",
  Analyse: "analyse",
  Improve: "improve",
  Compete: "compete",
  Account: "account",
  Admin: "account",
};

function routeFromMetadata(route: (typeof appRouteMetadata)[number]): ProductRoute {
  return {
    id: route.id,
    href: route.route,
    label: route.pageTitle,
    area: areaByNavigationGroup[route.navigationGroup],
    mobileVisibility: route.mobilePrimaryDestination
      ? "primary"
      : route.mobileMoreGroup
        ? "secondary"
        : "hidden",
    admin: Boolean(route.adminOnly),
    searchKeywords: [
      route.pageTitle,
      route.shortTitle,
      route.navigationGroup,
      route.route,
      ...route.searchAliases,
    ],
    icon: route.icon,
    badge: route.badge,
    isActive: (pathname) => findRouteMetadata(pathname)?.id === route.id,
  };
}

/**
 * Compatibility projection for existing desktop-workbench consumers.
 * Route facts live in `appRouteMetadata`; this file intentionally owns no
 * separate list of destinations.
 */
export const productRouteRegistry: readonly ProductRoute[] =
  appRouteMetadata.map(routeFromMetadata);

export function commandRoutes(isAdmin: boolean) {
  return routesAvailableTo(isAdmin).map(routeFromMetadata);
}

export function findProductRoute(pathname: string) {
  const route = findRouteMetadata(pathname);
  return route ? routeFromMetadata(route) : undefined;
}

export function productAreaLabel(area: ProductArea) {
  return area === "today" ? "Home" : `${area.charAt(0).toUpperCase()}${area.slice(1)}`;
}
