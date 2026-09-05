import { ShieldCheck } from "lucide-react";

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

const desktopAreaDefinitions = [
  { label: "Home", ids: ["today", "dashboard"] },
  {
    label: "Practice",
    ids: ["practice", "quick-range", "coach", "speed", "goals", "training-load"],
  },
  { label: "Sessions", ids: ["sessions", "shots", "compare", "simulator-lab"] },
  {
    label: "Rounds",
    ids: [
      "rounds",
      "handicap",
      "challenges",
      "tournaments",
      "leaderboard",
      "course-records",
      "achievements",
    ],
  },
  {
    label: "Strategy / Course Twin",
    ids: ["play-companion", "course-strategy", "course-twins", "courses"],
  },
  { label: "Bag", ids: ["bag", "quick-bag", "equipment"] },
  {
    label: "Insights",
    ids: ["analyse", "session-impact", "progress", "strokes-gained", "data-chat"],
  },
  { label: "Data", ids: ["import", "rapsodo", "providers"] },
  {
    label: "Settings",
    ids: [
      "settings",
      "notifications",
      "profile",
      "billing",
      "friends",
      "feed",
      "social-intelligence",
      "groups",
    ],
  },
] as const;

const adminIds = [
  "admin",
  "partners",
  "admin-system",
  "admin-users",
  "admin-moderation",
  "admin-billing",
  "admin-challenges",
] as const;

export function buildDesktopNavGroups(isAdmin: boolean): AppNavGroup[] {
  const availableIds = new Set(routesAvailableTo(isAdmin).map((route) => route.id));
  const definitions = [
    ...desktopAreaDefinitions,
    ...(isAdmin ? [{ label: "Admin", ids: adminIds }] : []),
  ];

  return definitions
    .map(({ label, ids }) => ({
      label,
      items: ids
        .filter((id) => availableIds.has(id))
        .map((id) => itemFor(id))
        .filter(
          (item) =>
            appRouteMetadata.find((route) => route.route === item.href)?.desktopVisible !== false,
        ),
    }))
    .filter((group) => group.items.length > 0);
}

const mobilePrimaryDefinitions = [
  { id: "today", label: "Today", group: "today" },
  { id: "practice", label: "Practice", group: "practice" },
  { id: "play-companion", label: "Play", group: "strategy" },
  { id: "progress", label: "Progress", group: "review" },
  { id: "bag", label: "Bag", group: "bag" },
] as const;

export const mobilePrimaryItems: AppNavItem[] = mobilePrimaryDefinitions.map(
  ({ id, label, group }) => {
    const item = itemFor(id);
    return {
      ...item,
      label,
      isActive: (pathname: string) => findRouteMetadata(pathname)?.mobilePrimaryGroup === group,
    };
  },
);

const mobileMoreGroupOrder = ["Golf", "Compete", "Account"] as const;

const mobileMoreIds = {
  Golf: ["import", "sessions", "shots", "speed", "training-load", "handicap", "goals"],
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
  if (pathname === "/shots/review") return "Review shots";
  if (pathname === "/import/result") return "Import result";
  return (
    mobilePrimaryItems.find((item) => item.href === pathname)?.label ??
    findRouteMetadata(pathname)?.pageTitle ??
    "Golf analytics"
  );
}
