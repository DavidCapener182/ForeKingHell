import { getRequestAppSurface } from "@/lib/app-surface-server";
import type { SessionHistorySearchParamsInput } from "@/lib/session-history-search-params";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<SessionHistorySearchParamsInput>;
}) {
  const [surface, resolvedSearchParams] = await Promise.all([getRequestAppSurface(), searchParams]);

  if (surface === "companion") {
    const { default: SessionsCompanionPage } = await import("./sessions-companion-page");
    return <SessionsCompanionPage searchParams={resolvedSearchParams} />;
  }

  const { default: SessionsWorkbenchPage } = await import("./sessions-workbench-page");
  return <SessionsWorkbenchPage searchParams={resolvedSearchParams} />;
}
