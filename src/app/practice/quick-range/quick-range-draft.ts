export const quickRangeClubs = [
  "Driver",
  "3 Wood",
  "5 Wood",
  "Hybrid",
  "5 Iron",
  "6 Iron",
  "7 Iron",
  "8 Iron",
  "9 Iron",
  "Pitching Wedge",
  "Gap Wedge",
  "Sand Wedge",
  "Lob Wedge",
];
export const quickRangeLabels = ["Playable", "Left", "Right", "Short", "Long", "Unlabelled"];

export type QuickRangeRecord = {
  id: string;
  finishedAt: string | null;
  club: string;
  focus: string;
  balls: number;
  target: string;
  count: number;
  notes: string;
  labels: string[];
  elapsed: number;
};
export type QuickRangeDraft = Omit<QuickRangeRecord, "id" | "finishedAt"> & {
  state: "ready" | "active" | "paused" | "finished";
  activityId?: string;
  finishedAt?: string | null;
  history?: QuickRangeRecord[];
};

function metrics(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const item = value as QuickRangeDraft;
  if (
    typeof item.club !== "string" ||
    !(
      quickRangeClubs.includes(item.club) ||
      /^[1-9] (Iron|Wood|Hybrid)$/.test(item.club) ||
      ["Approach Wedge", "Wedge"].includes(item.club)
    ) ||
    ![20, 30, 40, 60].includes(item.balls) ||
    typeof item.focus !== "string" ||
    typeof item.notes !== "string" ||
    typeof item.target !== "string" ||
    !Number.isFinite(item.count) ||
    !Number.isFinite(item.elapsed) ||
    !Array.isArray(item.labels)
  )
    return null;
  const count = Math.max(0, Math.min(10000, Math.trunc(item.count)));
  return {
    club: item.club,
    balls: item.balls,
    focus: item.focus.slice(0, 80),
    notes: item.notes.slice(0, 500),
    target: item.target.slice(0, 80),
    count,
    elapsed: Math.max(0, Math.min(604800, Math.trunc(item.elapsed))),
    labels: item.labels
      .filter(
        (label): label is string => typeof label === "string" && quickRangeLabels.includes(label),
      )
      .slice(0, count),
  };
}
function date(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

/** One account-scoped document retains the current activity and its recent notes. */
export function parseQuickRangeDraft(value: unknown): QuickRangeDraft | null {
  const parsed = metrics(value);
  if (!parsed) return null;
  const item = value as QuickRangeDraft;
  if (!["ready", "active", "paused", "finished"].includes(item.state)) return null;
  const history: QuickRangeRecord[] = [];
  for (const candidate of Array.isArray(item.history) ? item.history.slice(0, 50) : []) {
    const record = metrics(candidate);
    if (
      record &&
      typeof candidate.id === "string" &&
      candidate.id.length <= 100 &&
      !history.some((entry) => entry.id === candidate.id)
    ) {
      history.push({ ...record, id: candidate.id, finishedAt: date(candidate.finishedAt) });
    }
  }
  return {
    ...parsed,
    state: item.state,
    history,
    activityId: typeof item.activityId === "string" ? item.activityId.slice(0, 100) : undefined,
    finishedAt: date(item.finishedAt),
  };
}

export function updateQuickRangeDraft(
  current: QuickRangeDraft,
  change: Partial<QuickRangeDraft>,
  now: string,
): QuickRangeDraft {
  let next = { ...current, ...change };
  let history = current.history ?? [];
  // Preserve a legacy finished session even when New Quick Range is the next action.
  if (current.state === "finished") history = archive(current, history);
  if (next.state === "active" && current.state === "ready") {
    next = { ...next, activityId: now, finishedAt: null };
  }
  if (next.state === "finished") {
    next = { ...next, finishedAt: current.state === "finished" ? current.finishedAt : now };
    history = archive(next, history);
  }
  return { ...next, history };
}

function archive(draft: QuickRangeDraft, history: QuickRangeRecord[]): QuickRangeRecord[] {
  const { club, focus, balls, target, count, notes, labels, elapsed } = draft;
  const id = draft.activityId ?? "legacy";
  const record = {
    id,
    finishedAt: draft.finishedAt ?? null,
    club,
    focus,
    balls,
    target,
    count,
    notes,
    labels,
    elapsed,
  };
  return [record, ...history.filter((item) => item.id !== id)].slice(0, 50);
}
