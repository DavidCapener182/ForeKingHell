"use client";

import { useCallback, useMemo, useEffect, useRef, useTransition } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

import {
  buildSessionHistoryQuery,
  clearSessionHistoryQuery,
  resolveSessionHistorySearchParams,
  sessionHistoryHref,
  type SessionHistoryFilterPatch,
  type SessionHistoryFilterOptions,
  type SessionHistoryFilterSession,
} from "@/lib/session-history-search-params";

export function useSessionHistoryUrlState(
  sessions: readonly SessionHistoryFilterSession[],
  options?: SessionHistoryFilterOptions,
) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!options) return;
    const restore = () => {
      // Cross-route Back is restored by Next. Refresh only an already visible
      // History page when moving between its shallow filter entries.
      const toolbar = document.querySelector("[data-session-toolbar]");
      if (!toolbar?.getClientRects().length) return;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      startTransition(() => router.refresh());
    };
    window.addEventListener("popstate", restore, true);
    return () => window.removeEventListener("popstate", restore, true);
  }, [options, router]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const filters = useMemo(
    () =>
      resolveSessionHistorySearchParams(
        currentQuery,
        sessions,
        options ? { ...options, serverFiltered: true } : undefined,
      ).filters,
    [currentQuery, sessions, options],
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
      if (options && Object.keys(patch).some((key) => key !== "sessionId")) {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(
          () => startTransition(() => router.refresh()),
          patch.search !== undefined ? 250 : 0,
        );
      }
      writeHistoryEntry(
        buildSessionHistoryQuery(
          currentQuery,
          patch,
          sessions,
          options ? { ...options, serverFiltered: true } : undefined,
        ),
      );
    },
    [currentQuery, sessions, writeHistoryEntry, options, router],
  );

  const clearFilters = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    writeHistoryEntry(clearSessionHistoryQuery(currentQuery));
    if (options) startTransition(() => router.refresh());
  }, [currentQuery, writeHistoryEntry, options, router]);

  return { filters, updateFilters, clearFilters, pending };
}
