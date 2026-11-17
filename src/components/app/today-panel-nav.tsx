import Link from "next/link";
import { todayPanelHref, todayPanels, type TodayPanel } from "@/lib/today-panels";

export function TodayPanelNav({
  params,
  selected,
}: {
  params: Record<string, string | string[] | undefined>;
  selected: TodayPanel;
}) {
  return (
    <nav
      aria-label="Practice views"
      className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1 sm:flex sm:w-fit"
    >
      {(Object.keys(todayPanels) as TodayPanel[]).map((panel) => (
        <Link
          key={panel}
          href={todayPanelHref(params, panel)}
          prefetch={false}
          aria-current={selected === panel ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold ${selected === panel ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          {todayPanels[panel]}
        </Link>
      ))}
    </nav>
  );
}
