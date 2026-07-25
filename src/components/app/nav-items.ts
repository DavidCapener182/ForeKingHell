import { Menu } from "lucide-react";

import {
  appRouteMetadata,
  findRouteMetadata,
  routesAvailableTo,
  type AppRouteMetadata,
} from "@/components/app/route-metadata";

export type AppNavItem = {
  href: string;
  label: string;
  icon: AppRouteMetadata["icon"];
  badge?: string;
  isActive: (pathname: string) => boolean;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

function toNavItem(item: AppRouteMetadata): AppNavItem {
  return {
    href: item.route,
    label: item.shortTitle,
    icon: item.icon,
    badge: item.badge,
    isActive: (pathname) => findRouteMetadata(pathname)?.id === item.id,
  };
}

function itemFor(id: string) {
  const item = appRouteMetadata.find((candidate) => candidate.id === id);

  if (!item) {
    throw new Error(`Route metadata not found for ${id}.`);
  }

  return toNavItem(item);
}

const legacyDesktopGroupOrder = [
  "Home",
  "Play",
  "Analyse",
  "Improve",
  "Compete",
  "Account",
  "Admin",
] as const;

export function buildDesktopNavGroups(isAdmin: boolean): AppNavGroup[] {
  const available = routesAvailableTo(isAdmin);
  return legacyDesktopGroupOrder
    .filter((label) => isAdmin || label !== "Admin")
    .map((label) => ({
      label,
      items: available
        .filter((route) => route.navigationGroup === label && route.desktopVisible !== false)
        .map(toNavItem),
    }))
    .filter((group) => group.items.length > 0);
}

const mobilePrimaryDefinitions = [
  { id: "today", label: "Today", group: "home" },
  { id: "sessions", label: "Sessions", group: "sessions" },
  { id: "analyse", label: "Analyse", group: "analyse" },
  { id: "coach", label: "Improve", group: "practice" },
] as const;

export const mobilePrimaryItems: AppNavItem[] = [
  ...mobilePrimaryDefinitions.map(({ id, label, group }) => {
    const item = itemFor(id);
    return {
      ...item,
      label,
      isActive: (pathname: string) => findRouteMetadata(pathname)?.mobilePrimaryGroup === group,
    };
  }),
  {
    href: "#more",
    label: "More",
    icon: Menu,
    isActive: (pathname) => findRouteMetadata(pathname)?.mobilePrimaryGroup === "more",
  },
];

const mobileMoreGroupOrder = [
  "Home",
  "Play",
  "Analyse",
  "Improve",
  "Compete",
  "Social",
  "Account",
] as const;

function belongsInMobileMoreGroup(
  item: AppRouteMetadata,
  label: (typeof mobileMoreGroupOrder)[number],
) {
  if (
    item.mobilePrimaryDestination ||
    (item.desktopVisible === false && item.mobileMoreGroup === undefined)
  ) {
    return false;
  }

  if (label === "Social" || label === "Account") {
    return item.mobileMoreGroup === label;
  }

  if (label === "Play") {
    return item.navigationGroup === "Play" || item.mobileMoreGroup === "Play";
  }

  return item.navigationGroup === label;
}

export const mobileMoreGroups: AppNavGroup[] = mobileMoreGroupOrder
  .map((label) => ({
    label,
    items: routesAvailableTo(false)
      .filter((item) => belongsInMobileMoreGroup(item, label))
      .map(toNavItem),
  }))
  .filter((group) => group.items.length > 0);

export const adminNavGroup: AppNavGroup = {
  label: "Admin",
  items: routesAvailableTo(true)
    .filter((item) => item.mobileMoreGroup === "Admin")
    .map(toNavItem),
};

export function mobilePageTitle(pathname: string) {
  return findRouteMetadata(pathname)?.pageTitle ?? "Golf analytics";
}
