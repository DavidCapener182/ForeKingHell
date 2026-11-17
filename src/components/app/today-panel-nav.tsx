import Link from "next/link";
import { CalendarDays, ChartNoAxesCombined, ClipboardList, ScanLine } from "lucide-react";
import { todayPanelHref, todayPanels, type TodayPanel } from "@/lib/today-panels";
import styles from "./today-panel-nav.module.css";

const views = {
  home: { icon: CalendarDays, detail: "Latest practice and next steps" },
  patterns: { icon: ScanLine, detail: "Shot landings and trajectories" },
  trends: { icon: ChartNoAxesCombined, detail: "Compare clubs over time" },
  analysis: { icon: ClipboardList, detail: "Verdict, drills and shot evidence" },
};

export function TodayPanelNav({
  params,
  selected,
}: {
  params: Record<string, string | string[] | undefined>;
  selected: TodayPanel;
}) {
  return (
    <nav aria-label="Practice views" className={styles.nav}>
      {(Object.keys(views) as TodayPanel[]).map((panel) => {
        const { icon: Icon, detail } = views[panel];
        return (
          <Link
            key={panel}
            href={todayPanelHref(params, panel)}
            aria-current={selected === panel ? "page" : undefined}
            aria-label={todayPanels[panel]}
            prefetch={false}
            className={styles.link}
          >
            <Icon size={19} aria-hidden />
            <span>
              <strong>{todayPanels[panel]}</strong>
              <small>{detail}</small>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
