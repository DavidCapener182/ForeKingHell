"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  buildSessionHistoryQuery,
  clearSessionHistoryQuery,
  resolveSessionHistorySearchParams,
  sessionHistoryHref,
  type SessionHistoryFilterPatch,
  type SessionHistoryFilterSession,
} from "@/lib/session-history-search-params";

export function useSessionHistoryUrlState(sessions: readonly SessionHistoryFilterSession[]) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const filters = useMemo(
    () => resolveSessionHistorySearchParams(currentQuery, sessions).filters,
    [currentQuery, sessions],
  );

  const writeHistoryEntry = useCallback(
    (query: string) => {
      if (query === currentQuery) return;
      window.history.pushState(
        null,
        "",
        `${sessionHistoryHref(query, pathname)}${window.location.hash}`,
      );
    },
    [currentQuery, pathname],
  );

  const updateFilters = useCallback(
    (patch: SessionHistoryFilterPatch) => {
      writeHistoryEntry(buildSessionHistoryQuery(currentQuery, patch, sessions));
    },
    [currentQuery, sessions, writeHistoryEntry],
  );

  const clearFilters = useCallback(() => {
    writeHistoryEntry(clearSessionHistoryQuery(currentQuery));
  }, [currentQuery, writeHistoryEntry]);

  return { filters, updateFilters, clearFilters };
}
