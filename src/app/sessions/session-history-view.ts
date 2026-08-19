import {
  sessionMatchesHistoryFilters,
  type SessionHistoryFilters,
  type SessionHistoryFilterSession,
} from "@/lib/session-history-search-params";

export function deriveSessionHistoryView<T extends SessionHistoryFilterSession>(
  sessions: readonly T[],
  filters: SessionHistoryFilters,
) {
  const visible = sessions.filter((session) => sessionMatchesHistoryFilters(session, filters));
  const focused = visible.find((session) => session.id === filters.sessionId) ?? visible[0] ?? null;

  return { visible, focused };
}

export function pruneSessionComparisonSelection(
  selected: string[],
  visibleSessionIds: readonly string[],
) {
  const visibleIds = new Set(visibleSessionIds);
  const next = selected.filter((id) => visibleIds.has(id));

  return next.length === selected.length ? selected : next;
}
