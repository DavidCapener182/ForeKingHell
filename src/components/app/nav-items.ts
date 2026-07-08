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
    label: "Home",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: Gauge,
        isActive: (pathname) => pathname === "/" || pathname === "/dashboard",
      },
      {
        href: "/today",
        label: "Latest practice",
        icon: CalendarDays,
        isActive: (pathname) => pathname.startsWith("/today"),
      },
      {
        href: "/progress",
        label: "Progress",
        icon: LineChart,
        isActive: (pathname) => pathname.startsWith("/progress"),
      },
      {
        href: "/strokes-gained",
        label: "Strokes gained",
        icon: LineChart,
        isActive: (pathname) => pathname.startsWith("/strokes-gained"),
      },
    ],
  },
  {
    label: "Play",
    items: [
      {
        href: "/rounds",
        label: "Rounds",
        icon: Flag,
        isActive: (pathname) => pathname.startsWith("/rounds"),
      },
      {
        href: "/courses",
        label: "Courses",
        icon: MapPinned,
        isActive: (pathname) => pathname.startsWith("/courses"),
      },
      {
        href: "/course-records",
        label: "Course records",
        icon: Trophy,
        isActive: (pathname) => pathname.startsWith("/course-records"),
      },
      {
        href: "/tournaments",
        label: "Tournaments",
        icon: CalendarDays,
        isActive: (pathname) => pathname.startsWith("/tournaments"),
      },
      {
        href: "/handicap",
        label: "Handicap",
        icon: Calculator,
        isActive: (pathname) => pathname.startsWith("/handicap"),
      },
    ],
  },
  {
    label: "Analyse",
    items: [
      {
        href: "/compare",
        label: "Compare",
        icon: GitCompareArrows,
        isActive: (pathname) => pathname.startsWith("/compare"),
      },
      {
        href: "/bag",
        label: "Bag",
        icon: Target,
        isActive: (pathname) => pathname.startsWith("/bag"),
      },
      {
        href: "/simulator-lab",
        label: "Simulator Lab",
        icon: Radar,
        isActive: (pathname) => pathname.startsWith("/simulator-lab"),
      },
      {
        href: "/speed",
        label: "Speed Centre",
        icon: Gauge,
        isActive: (pathname) => pathname.startsWith("/speed"),
      },
      {
        href: "/stats/training-over-time",
        label: "Training Load",
        icon: LineChart,
        isActive: (pathname) => pathname.startsWith("/stats/training-over-time"),
      },
      {
        href: "/equipment",
        label: "Equipment",
        icon: Wrench,
        isActive: (pathname) => pathname.startsWith("/equipment"),
      },
      {
        href: "/shots",
        label: "Shots",
        icon: Database,
        isActive: (pathname) => pathname.startsWith("/shots"),
      },
      {
        href: "/rapsodo",
        label: "Rapsodo",
        icon: Upload,
        badge: "Beta",
        isActive: (pathname) => pathname.startsWith("/rapsodo"),
      },
    ],
  },
  {
    label: "Social",
    items: [
      {
        href: "/feed",
        label: "Feed",
        icon: Radio,
        isActive: (pathname) => pathname.startsWith("/feed"),
      },
      {
        href: "/friends",
        label: "Friends",
        icon: Users,
        isActive: (pathname) => pathname.startsWith("/friends"),
      },
      {
        href: "/groups",
        label: "Groups",
        icon: Users,
        isActive: (pathname) => pathname.startsWith("/groups"),
      },
      {
        href: "/challenges",
        label: "Challenges",
        icon: Trophy,
        isActive: (pathname) => pathname.startsWith("/challenges"),
      },
      {
        href: "/leaderboard",
        label: "Leaderboards",
        icon: Users,
        isActive: (pathname) => pathname.startsWith("/leaderboard"),
      },
      {
        href: "/profile",
        label: "Profile",
        icon: UserRound,
        isActive: (pathname) => pathname.startsWith("/profile"),
      },
      {
        href: "/social-intelligence",
        label: "Recaps & Safety",
        icon: ShieldAlert,
        isActive: (pathname) => pathname.startsWith("/social-intelligence"),
      },
    ],
  },
  {
    label: "Improve",
    items: [
      {
        href: "/practice",
        label: "Practice Planner",
        icon: ClipboardCheck,
        isActive: (pathname) => pathname.startsWith("/practice"),
      },
      {
        href: "/coach",
        label: "Coach",
        icon: Brain,
        isActive: (pathname) => pathname.startsWith("/coach"),
      },
      {
        href: "/data-chat",
        label: "Data Chat",
        icon: MessageCircle,
        isActive: (pathname) => pathname.startsWith("/data-chat"),
      },
      {
        href: "/achievements",
        label: "Achievements",
        icon: Award,
        isActive: (pathname) => pathname.startsWith("/achievements"),
      },
    ],
  },
  {
    label: "Platform",
    items: [
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
        href: "/providers",
        label: "Providers",
        icon: Cable,
        isActive: (pathname) => pathname.startsWith("/providers"),
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
    href: "/dashboard",
    label: "Home",
    icon: Gauge,
    isActive: (pathname) =>
      pathname === "/" ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/today") ||
      pathname.startsWith("/progress") ||
      pathname.startsWith("/strokes-gained"),
  },
  {
    href: "/rounds",
    label: "Play",
    icon: Flag,
    isActive: (pathname) =>
      pathname.startsWith("/rounds") ||
      pathname.startsWith("/courses") ||
      pathname.startsWith("/course-records") ||
      pathname.startsWith("/tournaments") ||
      pathname.startsWith("/handicap"),
  },
  {
    href: "/bag",
    label: "Analyse",
    icon: Target,
    isActive: (pathname) =>
      pathname.startsWith("/bag") ||
      pathname.startsWith("/simulator-lab") ||
      pathname.startsWith("/speed") ||
      pathname.startsWith("/stats/training-over-time") ||
      pathname.startsWith("/shots") ||
      pathname.startsWith("/compare") ||
      pathname.startsWith("/equipment") ||
      pathname.startsWith("/rapsodo"),
  },
  {
    href: "/coach",
    label: "Coach",
    icon: Brain,
    isActive: (pathname) =>
      pathname.startsWith("/practice") ||
      pathname.startsWith("/coach") ||
      pathname.startsWith("/data-chat") ||
      pathname.startsWith("/achievements"),
  },
  {
    href: "/feed",
    label: "Social",
    icon: Radio,
    isActive: (pathname) =>
      pathname.startsWith("/feed") ||
      pathname.startsWith("/friends") ||
      pathname.startsWith("/groups") ||
      pathname.startsWith("/challenges") ||
      pathname.startsWith("/leaderboard") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/social-intelligence"),
  },
];

const desktopNavOrder = new Map([
  ["Home", 0],
  ["Analyse", 1],
  ["Play", 2],
  ["Improve", 3],
  ["Social", 4],
  ["Platform", 5],
  ["Admin", 6],
]);

export function buildDesktopNavGroups(isAdmin: boolean) {
  const groups = isAdmin ? [...navGroups, adminNavGroup] : navGroups;

  return [...groups].sort(
    (left, right) =>
      (desktopNavOrder.get(left.label) ?? 99) - (desktopNavOrder.get(right.label) ?? 99),
  );
}
