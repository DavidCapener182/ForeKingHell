import type { LucideIcon } from "lucide-react";
import {
  Award,
  BellRing,
  Brain,
  Cable,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Cuboid,
  Database,
  Flag,
  Gauge,
  Gift,
  GitCompareArrows,
  LineChart,
  MapPinned,
  MessageCircle,
  Radar,
  Radio,
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
import {
  mobileCapabilities,
  type MobileExperience,
  type MobileRouteCapability,
} from "@/lib/app-route-capabilities";

export type { MobileExperience } from "@/lib/app-route-capabilities";

export type AppRouteMetadata = {
  id: string;
  route: string;
  pageTitle: string;
  shortTitle: string;
  navigationGroup: "Home" | "Play" | "Analyse" | "Improve" | "Compete" | "Account" | "Admin";
  mobilePrimaryGroup: "home" | "practice" | "play" | "sessions" | "analyse" | "more";
  mobilePrimaryDestination?: boolean;
  mobileMoreGroup?: "Play" | "Compete" | "Social" | "Account" | "Admin";
  mobileExperience: MobileExperience;
  mobileNav?: "primary" | "more" | false;
  mobileFallbackRoute?: string;
  mobileFallbackLabel?: string;
  mobileExplanation?: string;
  icon: LucideIcon;
  searchAliases: string[];
  badge?: string;
  tabKey?: string;
  adminOnly?: boolean;
  desktopVisible?: boolean;
};

type BaseAppRouteMetadata = Omit<AppRouteMetadata, keyof MobileRouteCapability>;

const baseAppRouteMetadata = [
  meta(
    "today",
    "/today",
    "Today",
    "Today",
    "Home",
    "home",
    CalendarDays,
    ["home", "latest session", "action centre"],
    { mobilePrimaryDestination: true },
  ),
  meta("dashboard", "/dashboard", "Dashboard", "Dashboard", "Home", "home", Gauge, [
    "command centre",
    "overview",
    "data health",
  ]),
  meta(
    "sessions",
    "/sessions",
    "Sessions",
    "Sessions",
    "Play",
    "sessions",
    Database,
    ["session history", "range sessions"],
    { mobilePrimaryDestination: true },
  ),
  meta(
    "rounds",
    "/rounds",
    "Rounds",
    "Rounds",
    "Play",
    "sessions",
    Flag,
    ["scorecard", "log round", "review round"],
    { mobileMoreGroup: "Play" },
  ),
  meta(
    "import",
    "/import",
    "Import data",
    "Import",
    "Play",
    "sessions",
    Upload,
    ["csv", "rapsodo", "upload", "launch monitor"],
    { mobileMoreGroup: "Play" },
  ),
  meta(
    "courses",
    "/courses",
    "Courses",
    "Courses",
    "Play",
    "sessions",
    MapPinned,
    ["course", "hole", "golf course"],
    { mobileMoreGroup: "Play" },
  ),
  meta(
    "course-twins",
    "/course-twins",
    "Course Twins",
    "Course Twin",
    "Play",
    "sessions",
    Cuboid,
    ["course twin", "course simulator", "play a course", "virtual round"],
    { mobileMoreGroup: "Play" },
  ),
  meta(
    "course-strategy",
    "/courses/strategy",
    "Course Strategy",
    "Strategy",
    "Play",
    "sessions",
    MapPinned,
    ["course plan", "safe target", "yardage plan"],
    { mobileMoreGroup: "Play" },
  ),
  meta("play-companion", "/play", "Play", "Play", "Play", "play", Flag, [
    "round preparation",
    "course strategy",
    "course twin",
  ]),
  meta(
    "analyse",
    "/analyse",
    "Analyse",
    "Analyse",
    "Analyse",
    "analyse",
    Radar,
    ["analysis", "shot analysis", "evidence"],
    { mobilePrimaryDestination: true },
  ),
  meta(
    "session-impact",
    "/analyse/session-impact",
    "Session impact",
    "Session impact",
    "Analyse",
    "analyse",
    GitCompareArrows,
    ["impact", "session change"],
    { desktopVisible: false },
  ),
  meta("shots", "/shots", "Shot explorer", "Shots", "Analyse", "analyse", Database, [
    "driver",
    "shot data",
    "raw shots",
    "dispersion",
  ]),
  meta("bag", "/bag", "Bag map", "Bag", "Analyse", "analyse", Target, [
    "yardages",
    "club carry",
    "gapping",
    "stock yardages",
  ]),
  meta("compare", "/compare", "Compare", "Compare", "Analyse", "analyse", GitCompareArrows, [
    "comparison",
    "session compare",
    "change",
  ]),
  meta("progress", "/progress", "Progress", "Progress", "Analyse", "analyse", LineChart, [
    "improvement",
    "trends",
  ]),
  meta(
    "strokes-gained",
    "/strokes-gained",
    "Strokes gained",
    "Strokes gained",
    "Analyse",
    "analyse",
    LineChart,
    ["strokes", "scoring", "gained"],
    { tabKey: "strokes" },
  ),
  meta(
    "simulator-lab",
    "/simulator-lab",
    "Simulator Performance Lab",
    "Performance Lab",
    "Analyse",
    "analyse",
    Radar,
    ["performance lab", "simulator", "launch monitor"],
  ),
  meta("handicap", "/handicap", "Handicap", "Handicap", "Analyse", "analyse", Calculator, [
    "handicap index",
    "scores",
  ]),
  meta(
    "coach",
    "/coach",
    "Coach",
    "Coach",
    "Improve",
    "practice",
    Brain,
    ["coaching", "drills", "diagnosis"],
    { mobilePrimaryDestination: true },
  ),
  meta(
    "practice",
    "/practice",
    "Practice Planner",
    "Practice",
    "Improve",
    "practice",
    ClipboardCheck,
    ["practice plan", "practice session", "range plan", "drill"],
  ),
  meta("quick-bag", "/quick-bag", "Quick Bag", "Quick Bag", "Improve", "more", Target, [
    "trusted carry",
    "club number",
    "target distance",
  ]),
  meta(
    "quick-range",
    "/practice/quick-range",
    "Quick Range",
    "Quick Range",
    "Improve",
    "practice",
    Gauge,
    ["quick practice", "range session"],
  ),
  meta("speed", "/speed", "Speed Centre", "Speed", "Improve", "practice", Gauge, [
    "club speed",
    "speed training",
  ]),
  meta(
    "training-load",
    "/stats/training-over-time",
    "Training Load",
    "Training load",
    "Improve",
    "analyse",
    LineChart,
    ["practice load", "training"],
    { tabKey: "training" },
  ),
  meta("goals", "/goals", "Goals", "Goals", "Improve", "practice", Target, ["goal", "season plan"]),
  meta("data-chat", "/data-chat", "Data Chat", "Data Chat", "Improve", "analyse", MessageCircle, [
    "ask data",
    "ai",
    "improve",
    "golf question",
  ]),
  meta(
    "challenges",
    "/challenges",
    "Challenges",
    "Challenges",
    "Compete",
    "more",
    Trophy,
    ["challenge", "compete"],
    { mobileMoreGroup: "Compete" },
  ),
  meta(
    "tournaments",
    "/tournaments",
    "Tournaments",
    "Tournaments",
    "Compete",
    "more",
    CalendarDays,
    ["tournament", "competition"],
    { mobileMoreGroup: "Compete" },
  ),
  meta(
    "leaderboard",
    "/leaderboard",
    "Leaderboards",
    "Leaderboards",
    "Compete",
    "more",
    Users,
    ["leaders", "ranking"],
    { mobileMoreGroup: "Compete" },
  ),
  meta(
    "course-records",
    "/course-records",
    "Course records",
    "Records",
    "Compete",
    "more",
    Trophy,
    ["record", "course record", "honours"],
    { mobileMoreGroup: "Compete" },
  ),
  meta("groups", "/groups", "Groups", "Groups", "Compete", "more", Users, ["group", "community"], {
    mobileMoreGroup: "Compete",
  }),
  meta(
    "achievements",
    "/achievements",
    "Achievements",
    "Achievements",
    "Compete",
    "more",
    Award,
    ["achievement", "badges"],
    { mobileMoreGroup: "Compete", desktopVisible: false },
  ),
  meta(
    "friends",
    "/friends",
    "Friends",
    "Friends",
    "Account",
    "more",
    Users,
    ["friend", "social"],
    { mobileMoreGroup: "Social" },
  ),
  meta(
    "feed",
    "/feed",
    "Activity feed",
    "Feed",
    "Account",
    "more",
    Radio,
    ["activity", "social feed"],
    { mobileMoreGroup: "Social", desktopVisible: false },
  ),
  meta(
    "social-intelligence",
    "/social-intelligence",
    "Recaps & Safety",
    "Safety",
    "Account",
    "more",
    ShieldAlert,
    ["social safety", "recaps"],
    { mobileMoreGroup: "Social", desktopVisible: false, tabKey: "recaps" },
  ),
  meta(
    "profile",
    "/profile",
    "Profile",
    "Profile",
    "Account",
    "more",
    UserRound,
    ["account", "profile"],
    { mobileMoreGroup: "Account" },
  ),
  meta(
    "equipment",
    "/equipment",
    "Equipment",
    "Equipment",
    "Account",
    "analyse",
    Wrench,
    ["clubs", "equipment"],
    { mobileMoreGroup: "Account" },
  ),
  meta(
    "rapsodo",
    "/rapsodo",
    "Rapsodo",
    "Rapsodo",
    "Account",
    "sessions",
    Upload,
    ["rapsodo cloud", "provider"],
    { mobileMoreGroup: "Play", badge: "Beta", desktopVisible: false },
  ),
  meta(
    "providers",
    "/providers",
    "Providers",
    "Providers",
    "Account",
    "more",
    Cable,
    ["launch monitor provider", "square", "trackman"],
    { mobileMoreGroup: "Account" },
  ),
  meta(
    "billing",
    "/billing",
    "Billing",
    "Billing",
    "Account",
    "more",
    CreditCard,
    ["plan", "subscription"],
    { mobileMoreGroup: "Account" },
  ),
  meta(
    "settings",
    "/settings",
    "Settings",
    "Settings",
    "Account",
    "more",
    Settings,
    ["preferences", "notifications"],
    { mobileMoreGroup: "Account" },
  ),
  meta(
    "notifications",
    "/settings/notifications",
    "Notifications",
    "Notifications",
    "Account",
    "more",
    BellRing,
    ["alerts", "notification settings"],
    { mobileMoreGroup: "Account" },
  ),
  meta("admin", "/admin", "Admin", "Admin", "Admin", "more", ShieldCheck, ["admin dashboard"], {
    adminOnly: true,
    badge: "Admin",
    mobileMoreGroup: "Admin",
  }),
  meta("partners", "/partners", "Partners", "Partners", "Admin", "more", Gift, ["partner"], {
    adminOnly: true,
    badge: "Plan",
    mobileMoreGroup: "Admin",
  }),
  meta(
    "admin-system",
    "/admin/system-checks",
    "System checks",
    "System",
    "Admin",
    "more",
    Cable,
    ["system", "health checks"],
    { adminOnly: true, badge: "Admin", mobileMoreGroup: "Admin" },
  ),
  meta("admin-users", "/admin/users", "Users", "Users", "Admin", "more", Users, ["user admin"], {
    adminOnly: true,
    badge: "Admin",
    mobileMoreGroup: "Admin",
  }),
  meta(
    "admin-moderation",
    "/admin/moderation",
    "Moderation",
    "Moderation",
    "Admin",
    "more",
    ShieldAlert,
    ["moderation"],
    { adminOnly: true, badge: "Admin", mobileMoreGroup: "Admin" },
  ),
  meta(
    "admin-billing",
    "/admin/billing",
    "Billing operations",
    "Billing ops",
    "Admin",
    "more",
    CreditCard,
    ["billing admin"],
    { adminOnly: true, badge: "Admin", mobileMoreGroup: "Admin" },
  ),
  meta(
    "admin-challenges",
    "/admin/challenges",
    "Challenge operations",
    "Challenge ops",
    "Admin",
    "more",
    Trophy,
    ["challenge admin"],
    { adminOnly: true, badge: "Admin", mobileMoreGroup: "Admin" },
  ),
];

export const appRouteMetadata: AppRouteMetadata[] = baseAppRouteMetadata.map((route) => ({
  ...route,
  ...mobileCapabilities[route.id],
}));

function meta<const Id extends string>(
  id: Id,
  route: string,
  pageTitle: string,
  shortTitle: string,
  navigationGroup: AppRouteMetadata["navigationGroup"],
  mobilePrimaryGroup: AppRouteMetadata["mobilePrimaryGroup"],
  icon: LucideIcon,
  searchAliases: string[],
  options: Partial<
    Omit<
      BaseAppRouteMetadata,
      | "id"
      | "route"
      | "pageTitle"
      | "shortTitle"
      | "navigationGroup"
      | "mobilePrimaryGroup"
      | "icon"
      | "searchAliases"
    >
  > = {},
): BaseAppRouteMetadata & { id: Id } {
  return {
    id,
    route,
    pageTitle,
    shortTitle,
    navigationGroup,
    mobilePrimaryGroup,
    icon,
    searchAliases,
    desktopVisible: true,
    tabKey: id,
    ...options,
  };
}

export function findRouteMetadata(pathname: string) {
  if (/^\/play\/[^/]+\/?$/.test(pathname)) {
    const courseTwin = appRouteMetadata.find((item) => item.id === "course-twins");
    return courseTwin
      ? {
          ...courseTwin,
          mobileExperience: "immersive" as const,
          mobilePrimaryGroup: "play" as const,
        }
      : undefined;
  }

  const directMatch = [...appRouteMetadata]
    .sort((left, right) => right.route.length - left.route.length)
    .find((item) => pathname === item.route || pathname.startsWith(`${item.route}/`));

  if (directMatch) return directMatch;

  return undefined;
}

export function isMobileImmersiveRoute(pathname: string) {
  return /^\/play\/[^/]+\/?$/.test(pathname);
}

const mobileCompanionHeroRoutes = new Set<string>();

export function isMobileCompanionHeroRoute(pathname: string) {
  return mobileCompanionHeroRoutes.has(pathname);
}

export type MobileBackNavigation = {
  href: string;
  label: string;
};

/**
 * Detail routes use a pushed-screen mobile header instead of pretending every
 * screen is another root destination. Keep this list explicit: the parent is
 * part of the information architecture, not something that can be inferred
 * safely from the final URL segment.
 */
export function mobileBackNavigation(pathname: string): MobileBackNavigation | null {
  const exactParents: Record<string, MobileBackNavigation> = {
    "/analyse/compare": { href: "/analyse", label: "Analyse" },
    "/analyse/conditions": { href: "/analyse", label: "Analyse" },
    "/analyse/session-impact": { href: "/analyse", label: "Analyse" },
    "/analyse/workspace": { href: "/analyse", label: "Analyse" },
    "/bag/longest": { href: "/bag", label: "Bag" },
    "/coach/diagnosis": { href: "/coach", label: "Coach" },
    "/coach/reports": { href: "/coach", label: "Coach" },
    "/coach/workspace": { href: "/coach", label: "Coach" },
    "/courses/new": { href: "/courses", label: "Courses" },
    "/courses/strategy": { href: "/courses", label: "Courses" },
    "/equipment/experiments": { href: "/equipment", label: "Equipment" },
    "/import/result": { href: "/import", label: "Import" },
    "/practice/quick-range": { href: "/practice", label: "Practice" },
    "/rounds/new": { href: "/rounds", label: "Rounds" },
    "/settings/notifications": { href: "/settings", label: "Settings" },
  };

  if (exactParents[pathname]) {
    return exactParents[pathname];
  }

  const clubAnalytics = pathname.match(/^\/bag\/([^/]+)\/analytics\/?$/);
  if (clubAnalytics) {
    return { href: `/bag/${clubAnalytics[1]}`, label: "Club" };
  }

  if (/^\/bag\/[^/]+\/?$/.test(pathname)) {
    return { href: "/bag", label: "Bag" };
  }

  if (/^\/rounds\/[^/]+\/?$/.test(pathname)) {
    return { href: "/rounds", label: "Rounds" };
  }

  if (/^\/speed\/sessions\/[^/]+\/?$/.test(pathname)) {
    return { href: "/speed", label: "Speed" };
  }

  if (/^\/course-records\/[^/]+\/?$/.test(pathname)) {
    return { href: "/course-records", label: "Records" };
  }

  if (/^\/challenges\/[^/]+\/?$/.test(pathname)) {
    return { href: "/challenges", label: "Challenges" };
  }

  if (/^\/groups\/[^/]+\/?$/.test(pathname)) {
    return { href: "/groups", label: "Groups" };
  }

  if (/^\/profile\/[^/]+\/?$/.test(pathname)) {
    return { href: "/friends", label: "Friends" };
  }

  if (/^\/shared\/[^/]+\/?$/.test(pathname)) {
    return { href: "/settings", label: "Settings" };
  }

  const courseRecord = pathname.match(/^\/courses\/([^/]+)\/records\/([^/]+)\/?$/);
  if (courseRecord) {
    return {
      href: `/courses/${courseRecord[1]}/records`,
      label: "Course records",
    };
  }

  if (/^\/courses\/[^/]+\/records\/?$/.test(pathname)) {
    return { href: "/course-records", label: "Records" };
  }

  const courseSection = pathname.match(
    /^\/courses\/([^/]+)\/(holes|records|shot-pattern|tournaments)\/?$/,
  );
  if (courseSection) {
    return { href: "/courses", label: "Courses" };
  }

  const tournamentSection = pathname.match(
    /^\/tournaments\/([^/]+)\/(leaderboard|rounds|rules|submit)\/?$/,
  );
  if (tournamentSection) {
    return { href: `/tournaments/${tournamentSection[1]}`, label: "Tournament" };
  }

  if (/^\/tournaments\/[^/]+\/?$/.test(pathname)) {
    return { href: "/tournaments", label: "Tournaments" };
  }

  if (/^\/settings\/invitations\/[^/]+\/?$/.test(pathname)) {
    return { href: "/settings", label: "Settings" };
  }

  return null;
}

export function routesAvailableTo(isAdmin: boolean) {
  return appRouteMetadata.filter((item) => !item.adminOnly || isAdmin);
}
