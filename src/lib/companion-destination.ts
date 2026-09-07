import {
  isDesktopOnlyCompanionPath,
  isSummaryOnlyCompanionPath,
} from "@/lib/app-route-capabilities";

export function companionDestination(value: string | undefined, fallback = "/today") {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://companion.invalid");
    if (url.origin !== "https://companion.invalid") return fallback;
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (pathname.includes("%") || /^\/(?:companion(?:-runtime)?|surface)(?:\/|$)/.test(pathname))
      return fallback;
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
export function hasDirectCompanionRoute(destination: string) {
  const pathname = new URL(destination, "https://companion.invalid").pathname;
  return (
    documentedRoutes.some((route) => route.test(pathname)) &&
    !isDesktopOnlyCompanionPath(pathname) &&
    !isSummaryOnlyCompanionPath(pathname)
  );
}

// Documented route patterns from ForeKingHell-route-coverage.csv. Entity access remains server-side.
const documentedRoutes = [
  "/progress",
  "/today",
  "/dashboard",
  "/sessions",
  "/sessions/[sessionId]",
  "/shots",
  "/shots/review",
  "/bag",
  "/bag/[clubId]",
  "/bag/[clubId]/analytics",
  "/bag/longest",
  "/quick-bag",
  "/equipment",
  "/equipment/experiments",
  "/practice",
  "/practice/quick-range",
  "/coach",
  "/coach/diagnosis",
  "/coach/reports",
  "/coach/workspace",
  "/data-chat",
  "/analyse",
  "/analyse/compare",
  "/analyse/conditions",
  "/analyse/session-impact",
  "/analyse/workspace",
  "/compare",
  "/strokes-gained",
  "/simulator-lab",
  "/speed",
  "/speed/sessions/[sessionId]",
  "/stats/training-over-time",
  "/goals",
  "/handicap",
  "/import",
  "/import/result",
  "/rapsodo",
  "/providers",
  "/rounds",
  "/rounds/new",
  "/rounds/[sessionId]",
  "/courses",
  "/courses/new",
  "/courses/[courseId]",
  "/courses/[courseId]/holes",
  "/courses/[courseId]/shot-pattern",
  "/courses/strategy",
  "/course-twins",
  "/play",
  "/play/[courseId]",
  "/course-records",
  "/courses/[courseId]/records",
  "/course-records/[recordId]",
  "/challenges",
  "/challenges/[challengeId]",
  "/tournaments",
  "/tournaments/[tournamentId]",
  "/leaderboard",
  "/achievements",
  "/friends",
  "/groups",
  "/groups/[groupSlug]",
  "/feed",
  "/social-intelligence",
  "/profile",
  "/profile/[username]",
  "/settings",
  "/settings/notifications",
  "/settings/invitations/[token]",
  "/shared/[userId]",
  "/billing",
  "/admin",
  "/admin/users",
  "/admin/moderation",
  "/admin/billing",
  "/admin/challenges",
  "/admin/system-checks",
  "/partners",
  "/",
  "/login",
  "/welcome",
  "/privacy",
  "/offline",
  "/share/[token]",
  "/share/course-twin/[token]",
  "/share/report/[token]",
  "/courses/[courseId]/records/[recordId]",
  "/courses/[courseId]/tournaments",
  "/tournaments/[tournamentId]/leaderboard",
  "/tournaments/[tournamentId]/rounds",
  "/tournaments/[tournamentId]/rules",
  "/tournaments/[tournamentId]/submit",
].map((route) => new RegExp("^" + route.replace(/\[[^\]]+\]/g, "[^/]+") + "$"));
