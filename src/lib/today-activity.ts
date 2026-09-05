export type TodayActivity = {
  id: string;
  kind: "practice" | "round" | "import" | "personal-best" | "achievement" | "goal";
  title: string;
  detail: string;
  href: string;
  date: Date;
};

/** Keep a busy import or retrospective badge sync from taking over the briefing. */
export function selectTodayActivity(items: TodayActivity[], now = new Date()): TodayActivity[] {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  return items
    .filter((item) => Number.isFinite(item.date.getTime()) && item.date <= now)
    .sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id))
    .filter((item) => {
      const group = item.kind === "personal-best" ? "achievement" : item.kind;
      if (seen.has(item.id) || (counts.get(group) ?? 0) >= 2) return false;
      seen.add(item.id);
      counts.set(group, (counts.get(group) ?? 0) + 1);
      return true;
    })
    .slice(0, 6);
}
