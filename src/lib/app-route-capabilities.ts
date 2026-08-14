export type MobileExperience = "companion" | "summary" | "immersive" | "desktop-only";

export type MobileRouteCapability = {
  mobileExperience: MobileExperience;
  mobileNav?: "primary" | "more" | false;
  mobileFallbackRoute?: string;
  mobileFallbackLabel?: string;
  mobileExplanation?: string;
};

export const mobileCapabilities = {
  today: companionPrimary(),
  dashboard: desktopOnly("Today", "/today", "The dashboard is a full analytical command centre."),
  sessions: companionPrimary(),
  rounds: { mobileExperience: "summary" },
  import: companionMore(),
  courses: companionMore(),
  "course-twins": { mobileExperience: "companion" },
  "course-strategy": { mobileExperience: "companion" },
  "play-companion": companionPrimary(),
  analyse: desktopOnly(
    "Review latest session",
    "/sessions",
    "Deep analysis needs detailed filters and comparison workspaces.",
  ),
  "session-impact": desktopOnly(
    "Review latest session",
    "/sessions",
    "Session-impact comparison is available in the full workbench.",
  ),
  shots: desktopOnly(
    "Review latest session",
    "/sessions",
    "Raw shot exploration is available in the full workbench.",
  ),
  bag: desktopOnly(
    "Open Quick Bag",
    "/quick-bag",
    "Full bag analytics and fitting tools are available in the full workbench.",
  ),
  compare: desktopOnly(
    "Review sessions",
    "/sessions",
    "Multi-session comparison is available in the full workbench.",
  ),
  progress: { mobileExperience: "summary" },
  "strokes-gained": desktopOnly(
    "Review latest round",
    "/sessions?type=rounds",
    "Strokes Gained needs detailed shot-event tables.",
  ),
  "simulator-lab": desktopOnly(
    "Review latest session",
    "/sessions",
    "Simulator Performance Lab is a full analytical workspace.",
  ),
  handicap: summaryMore(),
  coach: {
    mobileExperience: "summary",
    mobileFallbackRoute: "/practice",
    mobileFallbackLabel: "Build recommended practice",
  },
  practice: companionPrimary(),
  "quick-bag": companionMore(),
  "quick-range": { mobileExperience: "companion" },
  speed: desktopOnly(
    "Build recommended practice",
    "/practice?intent=speed",
    "Full speed history and programming are available in the workbench.",
  ),
  "training-load": desktopOnly(
    "Plan practice",
    "/practice",
    "Full training-load history is available in the workbench.",
  ),
  goals: summaryMore(),
  "data-chat": desktopOnly(
    "Build recommended practice",
    "/practice",
    "Long-form Data Chat is available in the full workbench.",
  ),
  challenges: summaryMore(),
  tournaments: summaryMore(),
  leaderboard: summaryMore(),
  "course-records": desktopOnly(
    "Prepare for a round",
    "/play",
    "Record administration and proof review are available in the workbench.",
  ),
  groups: desktopOnly(
    "Open current challenges",
    "/challenges",
    "Group management is available in the full workbench.",
  ),
  achievements: summaryMore(),
  friends: desktopOnly(
    "Open profile",
    "/profile",
    "Social management is available in the full workbench.",
  ),
  feed: desktopOnly(
    "Open profile",
    "/profile",
    "The activity feed is available in the full workbench.",
  ),
  "social-intelligence": desktopOnly(
    "Open profile",
    "/profile",
    "Social Intelligence is available in the full workbench.",
  ),
  profile: summaryMore(),
  equipment: desktopOnly(
    "Open Quick Bag",
    "/quick-bag",
    "Equipment setup and experiments are available in the full workbench.",
  ),
  rapsodo: companionMore(),
  providers: desktopOnly(
    "Import or sync",
    "/import",
    "Provider operations are available in the full workbench.",
  ),
  billing: desktopOnly(
    "Open settings",
    "/settings",
    "Billing operations are available in the full workbench.",
  ),
  settings: summaryMore(),
  notifications: summaryMore(),
  admin: desktopOnly("Go to Today", "/today", "Administration is available in the full workbench."),
  partners: desktopOnly(
    "Go to Today",
    "/today",
    "Partner operations are available in the full workbench.",
  ),
  "admin-system": desktopOnly(
    "Go to Today",
    "/today",
    "System checks are available in the full workbench.",
  ),
  "admin-users": desktopOnly(
    "Go to Today",
    "/today",
    "User administration is available in the full workbench.",
  ),
  "admin-moderation": desktopOnly(
    "Go to Today",
    "/today",
    "Moderation is available in the full workbench.",
  ),
  "admin-billing": desktopOnly(
    "Go to Today",
    "/today",
    "Billing operations are available in the full workbench.",
  ),
  "admin-challenges": desktopOnly(
    "Go to Today",
    "/today",
    "Challenge operations are available in the full workbench.",
  ),
} as const satisfies Record<string, MobileRouteCapability>;

const desktopOnlyPrefixes = [
  "/admin",
  "/partners",
  "/dashboard",
  "/analyse",
  "/shots",
  "/bag",
  "/compare",
  "/strokes-gained",
  "/simulator-lab",
  "/speed",
  "/stats/training-over-time",
  "/data-chat",
  "/equipment",
  "/providers",
  "/billing",
  "/social-intelligence",
  "/groups",
  "/friends",
  "/feed",
  "/course-records",
  "/courses",
  "/coach/diagnosis",
  "/coach/reports",
  "/coach/workspace",
] as const;

const companionExactRoutes = ["/courses"] as const;
const companionExceptions = ["/courses/strategy"] as const;
const summaryOnlyPrefixes = [
  "/coach",
  "/progress",
  "/handicap",
  "/goals",
  "/challenges",
  "/tournaments",
  "/leaderboard",
  "/achievements",
] as const;

export function isDesktopOnlyCompanionPath(pathname: string) {
  if (companionExactRoutes.some((route) => pathname === route)) return false;
  if (companionExceptions.some((route) => pathMatches(pathname, route))) return false;
  return desktopOnlyPrefixes.some((route) => pathMatches(pathname, route));
}

export function isSummaryOnlyCompanionPath(pathname: string) {
  return summaryOnlyPrefixes.some((route) => pathMatches(pathname, route));
}

function pathMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function companionPrimary(): MobileRouteCapability {
  return { mobileExperience: "companion", mobileNav: "primary" };
}

function companionMore(): MobileRouteCapability {
  return { mobileExperience: "companion", mobileNav: "more" };
}

function summaryMore(): MobileRouteCapability {
  return { mobileExperience: "summary", mobileNav: "more" };
}

function desktopOnly(
  fallbackLabel: string,
  fallbackRoute: string,
  explanation: string,
): MobileRouteCapability {
  return {
    mobileExperience: "desktop-only",
    mobileNav: false,
    mobileFallbackLabel: fallbackLabel,
    mobileFallbackRoute: fallbackRoute,
    mobileExplanation: explanation,
  };
}
