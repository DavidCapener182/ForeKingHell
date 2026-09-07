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
  dashboard: companionMore(),
  sessions: companionPrimary(),
  rounds: { mobileExperience: "companion" },
  import: companionMore(),
  courses: companionMore(),
  "course-twins": { mobileExperience: "companion" },
  "course-strategy": companionPrimary(),
  "play-companion": companionPrimary(),
  analyse: companionMore(),
  "session-impact": companionHidden(
    "Review latest session",
    "/sessions",
    "Session-impact comparison is available in the full workbench.",
  ),
  shots: companionMore(),
  bag: companionPrimary(),
  "best-shots": { mobileExperience: "companion" },
  compare: companionMore(),
  progress: companionMore(),
  "strokes-gained": companionMore(),
  "simulator-lab": companionMore(),
  handicap: companionMore(),
  coach: companionMore(),
  practice: companionPrimary(),
  "quick-bag": companionPrimary(),
  "quick-range": { mobileExperience: "companion" },
  speed: companionMore(),
  "training-load": companionMore(),
  goals: companionMore(),
  "data-chat": companionMore(),
  challenges: companionMore(),
  tournaments: companionMore(),
  leaderboard: companionMore(),
  "course-records": companionHidden(
    "Prepare for a round",
    "/play",
    "Record administration and proof review are available in the workbench.",
  ),
  groups: companionHidden(
    "Open current challenges",
    "/challenges",
    "Group management is available in the full workbench.",
  ),
  achievements: companionMore(),
  friends: companionHidden(
    "Open profile",
    "/profile",
    "Social management is available in the full workbench.",
  ),
  feed: companionHidden(
    "Open profile",
    "/profile",
    "The activity feed is available in the full workbench.",
  ),
  "social-intelligence": companionHidden(
    "Open profile",
    "/profile",
    "Social Intelligence is available in the full workbench.",
  ),
  profile: companionMore(),
  equipment: companionMore(),
  rapsodo: companionMore(),
  providers: companionMore(),
  billing: companionMore(),
  settings: companionMore(),
  notifications: companionMore(),
  admin: companionHidden("Go to Today", "/today", "Administration is available in the full workbench."),
  partners: companionHidden(
    "Go to Today",
    "/today",
    "Partner operations are available in the full workbench.",
  ),
  "admin-system": companionHidden(
    "Go to Today",
    "/today",
    "System checks are available in the full workbench.",
  ),
  "admin-users": companionHidden(
    "Go to Today",
    "/today",
    "User administration is available in the full workbench.",
  ),
  "admin-moderation": companionHidden(
    "Go to Today",
    "/today",
    "Moderation is available in the full workbench.",
  ),
  "admin-billing": companionHidden(
    "Go to Today",
    "/today",
    "Billing operations are available in the full workbench.",
  ),
  "admin-challenges": companionHidden(
    "Go to Today",
    "/today",
    "Challenge operations are available in the full workbench.",
  ),
} as const satisfies Record<string, MobileRouteCapability>;

const desktopOnlyPrefixes = [
  "/admin",
  "/partners",
  "/analyse",
  "/compare",
  "/strokes-gained",
  "/simulator-lab",
  "/data-chat",
  "/equipment",
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

const companionExactRoutes = ["/partners", "/admin/system-checks", "/admin/challenges", "/admin/billing", "/admin/moderation", "/admin/users", "/admin", "/billing", "/profile", "/social-intelligence", "/feed", "/groups", "/friends", "/achievements", "/leaderboard", "/course-records", "/simulator-lab", "/strokes-gained", "/compare", "/analyse", "/analyse/workspace", "/analyse/session-impact", "/analyse/conditions", "/analyse/compare", "/data-chat", "/coach/workspace", "/coach/reports", "/coach/diagnosis", "/coach", "/courses", "/courses/new", "/equipment", "/equipment/experiments"] as const;
const companionExceptions = ["/profile", "/groups", "/courses/strategy"] as const;
const summaryOnlyPrefixes = [
  "/coach",
  "/leaderboard",
  "/achievements",
] as const;

export function isDesktopOnlyCompanionPath(pathname: string) {
  if (/^\/courses\/[^/]+\/records\/[^/]+$/.test(pathname)) return false;
  if (/^\/course-records\/[^/]+$/.test(pathname)) return false;
  if (/^\/courses\/[^/]+(?:\/(?:holes|shot-pattern|records|tournaments))?$/.test(pathname)) return false;
  if (companionExactRoutes.some((route) => pathname === route)) return false;
  if (companionExceptions.some((route) => pathMatches(pathname, route))) return false;
  return desktopOnlyPrefixes.some((route) => pathMatches(pathname, route));
}

export function isSummaryOnlyCompanionPath(pathname: string) {
  if (companionExactRoutes.some((route) => pathname === route)) return false;
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

// These pages are available directly, but remain outside the mobile navigation.
// Route authorization and unknown nested-path handoffs are controlled separately.
function companionHidden(fallbackLabel: string, fallbackRoute: string, explanation: string): MobileRouteCapability {
  return { mobileExperience: "companion", mobileNav: false,
    mobileFallbackLabel: fallbackLabel, mobileFallbackRoute: fallbackRoute, mobileExplanation: explanation };
}
