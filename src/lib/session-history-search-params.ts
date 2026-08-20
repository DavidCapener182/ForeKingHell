export type SessionTypeFilter = "all" | "practice" | "round";
export type SessionDateFilter = "all" | "today" | "week" | "earlier";

export type SessionHistoryFilters = {
  type: SessionTypeFilter;
  source: string;
  club: string;
  date: SessionDateFilter;
  sessionId: string | null;
};

export type SessionHistoryFilterPatch = Partial<SessionHistoryFilters>;

export type SessionHistoryFilterSession = {
  id: string;
  isRound: boolean;
  sourceLabel: string;
  clubs: readonly string[];
  dateGroup: string;
};

export type SessionHistorySearchParamsInput = Record<string, string | string[] | undefined>;

export const DEFAULT_SESSION_HISTORY_FILTERS: Readonly<SessionHistoryFilters> = {
  type: "all",
  source: "all",
  club: "all",
  date: "all",
  sessionId: null,
};

const ownedQueryKeys = ["type", "source", "club", "date", "session"] as const;

export function resolveSessionHistorySearchParams(
  input: SessionHistorySearchParamsInput | string,
  sessions: readonly SessionHistoryFilterSession[],
) {
  const params = toUrlSearchParams(input);
  let changed = false;

  const typeResult = readSingleValue(params, "type");
  let type: SessionTypeFilter = "all";
  if (!typeResult.valid) {
    params.delete("type");
    changed = true;
  } else if (typeResult.value === "all") {
    params.delete("type");
    changed = true;
  } else if (typeResult.value === "rounds") {
    type = "round";
    params.set("type", type);
    changed = true;
  } else if (typeResult.value === "practice" || typeResult.value === "round") {
    type = typeResult.value;
  } else if (typeResult.value !== null) {
    params.delete("type");
    changed = true;
  }

  const sourceResult = readSingleValue(params, "source");
  let source = "all";
  if (!sourceResult.valid) {
    params.delete("source");
    changed = true;
  } else if (sourceResult.value === "all") {
    params.delete("source");
    changed = true;
  } else if (
    sourceResult.value !== null &&
    sessions.some((session) => session.sourceLabel === sourceResult.value)
  ) {
    source = sourceResult.value;
  } else if (sourceResult.value !== null) {
    params.delete("source");
    changed = true;
  }

  const clubResult = readSingleValue(params, "club");
  let club = "all";
  if (!clubResult.valid) {
    params.delete("club");
    changed = true;
  } else if (clubResult.value === "all") {
    params.delete("club");
    changed = true;
  } else if (
    clubResult.value !== null &&
    sessions.some((session) => session.clubs.includes(clubResult.value!))
  ) {
    club = clubResult.value;
  } else if (clubResult.value !== null) {
    params.delete("club");
    changed = true;
  }

  const dateResult = readSingleValue(params, "date");
  let date: SessionDateFilter = "all";
  if (!dateResult.valid) {
    params.delete("date");
    changed = true;
  } else if (dateResult.value === "all") {
    params.delete("date");
    changed = true;
  } else if (
    dateResult.value === "today" ||
    dateResult.value === "week" ||
    dateResult.value === "earlier"
  ) {
    date = dateResult.value;
  } else if (dateResult.value !== null) {
    params.delete("date");
    changed = true;
  }

  const filtersWithoutSession: SessionHistoryFilters = {
    type,
    source,
    club,
    date,
    sessionId: null,
  };
  const sessionResult = readSingleValue(params, "session");
  let sessionId: string | null = null;
  if (!sessionResult.valid) {
    params.delete("session");
    changed = true;
  } else if (
    sessionResult.value !== null &&
    sessions.some(
      (session) =>
        session.id === sessionResult.value &&
        sessionMatchesHistoryFilters(session, filtersWithoutSession),
    )
  ) {
    sessionId = sessionResult.value;
  } else if (sessionResult.value !== null) {
    params.delete("session");
    changed = true;
  }

  return {
    filters: { ...filtersWithoutSession, sessionId },
    query: params.toString(),
    changed,
  };
}

export function buildSessionHistoryQuery(
  currentQuery: string,
  patch: SessionHistoryFilterPatch,
  sessions: readonly SessionHistoryFilterSession[],
) {
  const params = new URLSearchParams(currentQuery);
  const current = resolveSessionHistorySearchParams(currentQuery, sessions).filters;
  const filterChanged = (["type", "source", "club", "date"] as const).some(
    (key) => Object.hasOwn(patch, key) && patch[key] !== current[key],
  );

  if (Object.hasOwn(patch, "type")) setOwnedValue(params, "type", patch.type, "all");
  if (Object.hasOwn(patch, "source")) setOwnedValue(params, "source", patch.source, "all");
  if (Object.hasOwn(patch, "club")) setOwnedValue(params, "club", patch.club, "all");
  if (Object.hasOwn(patch, "date")) setOwnedValue(params, "date", patch.date, "all");
  if (Object.hasOwn(patch, "sessionId")) {
    setOwnedValue(params, "session", patch.sessionId, null);
  } else if (filterChanged) {
    params.delete("session");
  }

  return resolveSessionHistorySearchParams(params.toString(), sessions).query;
}

export function clearSessionHistoryQuery(currentQuery: string) {
  const params = new URLSearchParams(currentQuery);
  for (const key of ownedQueryKeys) params.delete(key);
  return params.toString();
}

export function sessionHistoryHref(query: string, pathname = "/sessions") {
  return query ? `${pathname}?${query}` : pathname;
}

export function sessionMatchesHistoryFilters(
  session: SessionHistoryFilterSession,
  filters: SessionHistoryFilters,
) {
  if (filters.type === "round" && !session.isRound) return false;
  if (filters.type === "practice" && session.isRound) return false;
  if (filters.source !== "all" && session.sourceLabel !== filters.source) return false;
  if (filters.club !== "all" && !session.clubs.includes(filters.club)) return false;

  const dateGroup =
    filters.date === "today"
      ? "Today"
      : filters.date === "week"
        ? "This week"
        : filters.date === "earlier"
          ? "Earlier"
          : null;
  return dateGroup === null || session.dateGroup === dateGroup;
}

function toUrlSearchParams(input: SessionHistorySearchParamsInput | string) {
  if (typeof input === "string") return new URLSearchParams(input);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.append(key, value);
    }
  }
  return params;
}

function readSingleValue(params: URLSearchParams, key: string) {
  const values = params.getAll(key);
  if (values.length === 0) return { value: null, valid: true } as const;
  if (values.length !== 1 || values[0].length === 0) {
    return { value: null, valid: false } as const;
  }
  return { value: values[0], valid: true } as const;
}

function setOwnedValue(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
  defaultValue: string | null,
) {
  if (value === undefined) return;
  if (value === null || value === defaultValue) {
    params.delete(key);
    return;
  }
  params.set(key, value);
}
