"use client";
import { useSyncExternalStore, type ReactNode } from "react";
const subscribe = () => () => {};
import { useSearchParams } from "next/navigation";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
export const todaySections = [
  { id: "overview", label: "Overview" },
  { id: "practice", label: "Practice" },
  { id: "evidence", label: "Evidence" },
  { id: "data-quality", label: "Data quality" },
] as const;
type TodaySection = (typeof todaySections)[number]["id"];
export function TodayWorkspaceTabs({ panels }: { panels: Record<TodaySection, ReactNode> }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const query = useSearchParams();
  const selected = todaySections.some((item) => item.id === query.get("tab"))
    ? query.get("tab")!
    : "overview";
  return (
    <div data-today-workspace-tabs data-ready={ready}>
      <UntitledTabs
        label="Today sections"
        selectedKey={selected}
        keepMounted
        onSelectionChange={(key) => {
          const next = new URL(window.location.href);
          next.searchParams.set("tab", key);
          window.history.pushState(null, "", `${next.pathname}${next.search}${next.hash}`);
        }}
        items={todaySections.map((item) => ({ ...item, content: panels[item.id] }))}
      />
    </div>
  );
}
