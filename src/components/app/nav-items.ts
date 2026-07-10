import type { LucideIcon } from "lucide-react";
import {
  Award,
  Brain,
  Calculator,
  CalendarDays,
  Cable,
  ClipboardCheck,
  CreditCard,
  Database,
  Flag,
  Gauge,
  Gift,
  GitCompareArrows,
  LineChart,
  MapPinned,
  MessageCircle,
  Radio,
  Radar,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trophy,
  Upload,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  isActive: (pathname: string) => boolean;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export const navGroups: AppNavGroup[] = [
  {
    label: "Review",
    items: [
      {
        href: "/today",
        label: "Today",
        icon: CalendarDays,
        isActive: (pathname) => pathname === "/" || pathname.startsWith("/today"),
      },
      {
        href: "/sessions",
        label: "Sessions",
        icon: Database,
        isActive: (pathname) => pathname.startsWith("/sessions"),
      },
      {
        href: "/shots",
        label: "Shots",
        icon: Database,
        isActive: (pathname) => pathname.startsWith("/shots"),
      },
      {
        href: "/bag",
        label: "Bag",
        icon: Target,
        isActive: (pathname) => pathname.startsWith("/bag"),
      },
      {
        href: "/rounds",
        label: "Rounds",
        icon: Flag,
        isActive: (pathname) => pathname.startsWith("/rounds"),
      },
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: Gauge,
        isActive: (pathname) => pathname.startsWith("/dashboard"),
      },
      {
        href: "/import",
        label: "Import data",
        icon: Upload,
        isActive: (pathname) => pathname.startsWith("/import"),
      },
    ],
  },
  {
    label: "Improve",
    items: [
      {
        href: "/analyse",
        label: "Analyse",
        icon: Radar,
        isActive: (pathname) => pathname.startsWith("/analyse"),
      },
      {
        href: "/progress",
        label: "Progress",
        icon: LineChart,
        isActive: (pathname) => pathname.startsWith("/progress"),
      },
      {
        href: "/coach",
        label: "Coach",
        icon: Brain,
        isActive: (pathname) => pathname.startsWith("/coach"),
      },
      {
        href: "/practice",
        label: "Practice Planner",
        icon: ClipboardCheck,
        isActive: (pathname) => pathname.startsWith("/practice"),
      },
      {
        href: "/compare",
        label: "Compare",
        icon: GitCompareArrows,
        isActive: (pathname) => pathname.startsWith("/compare"),
      },
      {
        href: "/simulator-lab",
        label: "Performance Lab",
        icon: Radar,
        isActive: (pathname) => pathname.startsWith("/simulator-lab"),
      },
      {
        href: "/strokes-gained",
        label: "Strokes gained",
        icon: LineChart,
        isActive: (pathname) => pathname.startsWith("/strokes-gained"),
      },
      {
        href: "/handicap",
        label: "Handicap",
        icon: Calculator,
        isActive: (pathname) => pathname.startsWith("/handicap"),
      },
      {
        href: "/speed",
        label: "Speed Centre",
        icon: Gauge,
        isActive: (pathname) => pathname.startsWith("/speed"),
      },
      {
        href: "/stats/training-over-time",
        label: "Training load",
        icon: LineChart,
        isActive: (pathname) => pathname.startsWith("/stats/training-over-time"),
      },
      {
        href: "/data-chat",
        label: "Data Chat",
        icon: MessageCircle,
        isActive: (pathname) => pathname.startsWith("/data-chat"),
      },
    ],
  },
  {
    label: "Compete",
    items: [
      {
        href: "/achievements",
        label: "Achievements",
        icon: Award,
        isActive: (pathname) => pathname.startsWith("/achievements"),
      },
      {
        href: "/course-records",
        label: "Course records",
        icon: Trophy,
        isActive: (pathname) => pathname.startsWith("/course-records"),
      },
      {
        href: "/challenges",
        label: "Challenges",
        icon: Trophy,
        isActive: (pathname) => pathname.startsWith("/challenges"),
      },
      {
        href: "/tournaments",
        label: "Tournaments",
        icon: CalendarDays,
        isActive: (pathname) => pathname.startsWith("/tournaments"),
      },
      {
        href: "/leaderboard",
        label: "Leaderboards",
        icon: Users,
        isActive: (pathname) => pathname.startsWith("/leaderboard"),
      },
      {
        href: "/groups",
        label: "Groups",
        icon: Users,
        isActive: (pathname) => pathname.startsWith("/groups"),
      },
      {
        href: "/friends",
        label: "Friends",
        icon: Users,
        isActive: (pathname) => pathname.startsWith("/friends"),
      },
      {
        href: "/feed",
        label: "Feed",
        icon: Radio,
        isActive: (pathname) => pathname.startsWith("/feed"),
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        href: "/profile",
        label: "Profile",
        icon: UserRound,
        isActive: (pathname) => pathname.startsWith("/profile"),
      },
      {
        href: "/equipment",
        label: "Equipment",
        icon: Wrench,
        isActive: (pathname) => pathname.startsWith("/equipment"),
      },
      {
        href: "/courses",
        label: "Courses",
        icon: MapPinned,
        isActive: (pathname) => pathname.startsWith("/courses"),
      },
      {
        href: "/rapsodo",
        label: "Rapsodo",
        icon: Upload,
        badge: "Beta",
        isActive: (pathname) => pathname.startsWith("/rapsodo"),
      },
      {
        href: "/providers",
        label: "Providers",
        icon: Cable,
        isActive: (pathname) => pathname.startsWith("/providers"),
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        isActive: (pathname) => pathname.startsWith("/settings"),
      },
      {
        href: "/billing",
        label: "Billing",
        icon: CreditCard,
        isActive: (pathname) => pathname.startsWith("/billing"),
      },
      {
        href: "/social-intelligence",
        label: "Recaps & Safety",
        icon: ShieldAlert,
        isActive: (pathname) => pathname.startsWith("/social-intelligence"),
      },
    ],
  },
];

export const partnerNavItem: AppNavItem = {
  href: "/partners",
  label: "Partners",
  icon: Gift,
  badge: "Plan",
  isActive: (pathname) => pathname.startsWith("/partners"),
};

export const adminNavItem: AppNavItem = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheck,
  badge: "Admin",
  isActive: (pathname) => pathname === "/admin",
};

export const adminNavGroup: AppNavGroup = {
  label: "Admin",
  items: [
    adminNavItem,
    partnerNavItem,
    {
      href: "/admin/system-checks",
      label: "System checks",
      icon: Cable,
      badge: "Admin",
      isActive: (pathname) => pathname.startsWith("/admin/system-checks"),
    },
    {
      href: "/admin/users",
      label: "Users",
      icon: Users,
      badge: "Admin",
      isActive: (pathname) => pathname.startsWith("/admin/users"),
    },
    {
      href: "/admin/moderation",
      label: "Moderation",
      icon: ShieldAlert,
      badge: "Admin",
      isActive: (pathname) => pathname.startsWith("/admin/moderation"),
    },
    {
      href: "/admin/billing",
      label: "Billing ops",
      icon: CreditCard,
      badge: "Admin",
      isActive: (pathname) => pathname.startsWith("/admin/billing"),
    },
    {
      href: "/admin/challenges",
      label: "Challenge ops",
      icon: Trophy,
      badge: "Admin",
      isActive: (pathname) => pathname.startsWith("/admin/challenges"),
    },
  ],
};

export const mobilePrimaryItems: AppNavItem[] = [
  {
    href: "/today",
    label: "Today",
    icon: CalendarDays,
    isActive: (pathname) =>
      pathname === "/" || pathname.startsWith("/dashboard") || pathname.startsWith("/today"),
  },
  {
    href: "/sessions",
    label: "Sessions",
    icon: Database,
    isActive: (pathname) =>
      pathname.startsWith("/sessions") ||
      pathname.startsWith("/rounds") ||
      pathname.startsWith("/courses") ||
      pathname.startsWith("/rapsodo"),
  },
  {
    href: "/analyse",
    label: "Analyse",
    icon: Radar,
    isActive: (pathname) =>
      pathname.startsWith("/analyse") ||
      pathname.startsWith("/simulator-lab") ||
      pathname.startsWith("/progress") ||
      pathname.startsWith("/stats/training-over-time") ||
      pathname.startsWith("/shots") ||
      pathname.startsWith("/compare") ||
      pathname.startsWith("/coach") ||
      pathname.startsWith("/practice") ||
      pathname.startsWith("/data-chat") ||
      pathname.startsWith("/handicap") ||
      pathname.startsWith("/strokes-gained"),
  },
  {
    href: "/bag",
    label: "Bag",
    icon: Target,
    isActive: (pathname) =>
      pathname.startsWith("/bag") ||
      pathname.startsWith("/equipment") ||
      pathname.startsWith("/speed"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: UserRound,
    isActive: (pathname) =>
      pathname.startsWith("/profile") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/billing") ||
      pathname.startsWith("/providers") ||
      pathname.startsWith("/achievements") ||
      pathname.startsWith("/feed") ||
      pathname.startsWith("/friends") ||
      pathname.startsWith("/groups") ||
      pathname.startsWith("/challenges") ||
      pathname.startsWith("/leaderboard") ||
      pathname.startsWith("/tournaments") ||
      pathname.startsWith("/course-records") ||
      pathname.startsWith("/social-intelligence"),
  },
];

const desktopNavOrder = new Map([
  ["Review", 0],
  ["Improve", 1],
  ["Compete", 2],
  ["Manage", 3],
  ["Admin", 4],
]);

export function buildDesktopNavGroups(isAdmin: boolean) {
  const groups = isAdmin ? [...navGroups, adminNavGroup] : navGroups;

  return [...groups].sort(
    (left, right) =>
      (desktopNavOrder.get(left.label) ?? 99) - (desktopNavOrder.get(right.label) ?? 99),
  );
}

export function mobilePageTitle(pathname: string) {
  if (pathname.startsWith("/analyse/session-impact")) return "Session impact";
  for (const group of navGroups) {
    const match = group.items.find((item) => item.isActive(pathname));
    if (match) return match.label;
  }

  return "Golf analytics";
}
