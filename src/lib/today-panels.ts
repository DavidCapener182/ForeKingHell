type TodayParams = Record<string, string | string[] | undefined>;

export const todayPanels = {
  home: "Summary",
  trends: "Club trends",
  patterns: "Dispersion & ball flight",
  analysis: "Practice review",
} as const;
export type TodayPanel = keyof typeof todayPanels;

export function selectedTodayPanel(params: TodayParams): TodayPanel {
  const panel = params.panel;
  if (typeof panel === "string" && Object.hasOwn(todayPanels, panel)) return panel as TodayPanel;
  if (Object.keys(params).some((key) => key.startsWith("cp"))) return "trends";
  if (
    params.tab ||
    params.social ||
    params.clubSort ||
    params.evidence ||
    params.view === "practice"
  )
    return "analysis";
  return "home";
}

export function todayPanelHref(params: TodayParams, panel: TodayPanel) {
  const query = new URLSearchParams();
  for (const key of ["date", "session", "club", "view"]) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  query.set("panel", panel);
  return `/today?${query}`;
}
