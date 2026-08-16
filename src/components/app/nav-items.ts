import { Menu, ShieldCheck } from "lucide-react";

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
  { id: "practice", label: "Practice", group: "practice" },
  { id: "play-companion", label: "Play", group: "play" },
  { id: "sessions", label: "Sessions", group: "sessions" },
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
    isActive: (pathname) => findRouteMetadata(pathname)?.mobileNav === "more",
  },
];

const mobileMoreGroupOrder = ["Golf", "Compete", "Account"] as const;

const mobileMoreIds = {
  Golf: ["bag", "quick-bag", "import", "handicap", "goals"],
  Compete: ["challenges", "tournaments", "leaderboard", "achievements"],
  Account: ["profile", "notifications", "settings"],
} as const;

function belongsInMobileMoreGroup(
  item: AppRouteMetadata,
  label: (typeof mobileMoreGroupOrder)[number],
) {
  return item.mobileNav === "more" && mobileMoreIds[label].some((id) => id === item.id);
}

export const mobileMoreGroups: AppNavGroup[] = mobileMoreGroupOrder
  .map((label) => ({
    label,
    items: [
      ...routesAvailableTo(false)
        .filter((item) => belongsInMobileMoreGroup(item, label))
        .map((item) => ({
          ...toNavItem(item),
          label: item.id === "import" ? "Import & Sync" : item.shortTitle,
        })),
      ...(label === "Account"
        ? [
            {
              href: "/privacy",
              label: "Privacy",
              icon: ShieldCheck,
              isActive: (pathname: string) => pathname === "/privacy",
            },
          ]
        : []),
    ],
  }))
  .filter((group) => group.items.length > 0);

export function mobilePageTitle(pathname: string) {
  return findRouteMetadata(pathname)?.pageTitle ?? "Golf analytics";
}
