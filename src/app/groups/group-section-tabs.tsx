"use client";
import { useEffect, useState, type ReactNode } from "react";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { useClientReady } from "@/hooks/use-client-ready";
export type GroupSection = "overview" | "activity" | "members";
export function GroupSectionTabs({
  activeSection,
  items,
}: {
  activeSection: GroupSection;
  items: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const ready = useClientReady();
  const [active, setActive] = useState<string>(activeSection);
  useEffect(() => {
    const sync = () => {
      const url = new URL(window.location.href);
      const key = url.searchParams.get("section") ?? url.hash.slice(1);
      setActive(items.some((i) => i.id === key) ? key! : "overview");
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [items]);
  return (
    <section className="grid min-w-0 gap-3">
      <p className="text-sm text-muted-foreground">
        Swipe for Overview, Activity and Members. Draft posts stay on this page when you switch
        sections.
      </p>
      <UntitledTabs
        label="Group sections"
        selectedKey={active}
        disabled={!ready}
        keepMounted
        items={items}
        onSelectionChange={(key) => {
          setActive(key);
          const url = new URL(window.location.href);
          url.searchParams.set("section", key);
          for (const flag of ["created", "posted", "joined"]) url.searchParams.delete(flag);
          window.history.pushState(null, "", url.pathname + url.search);
        }}
      />
    </section>
  );
}
