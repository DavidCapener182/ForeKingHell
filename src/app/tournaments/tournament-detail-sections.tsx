"use client";
import { useEffect, useState, type ReactNode } from "react";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { useClientReady } from "@/hooks/use-client-ready";
export function TournamentDetailSections({
  active,
  items,
}: {
  active: string;
  items: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const ready = useClientReady();
  const [selected, setSelected] = useState(active);
  useEffect(() => {
    const onPop = () => {
      const tab = new URL(window.location.href).searchParams.get("tab");
      setSelected(
        tab === "rounds" ? "submit" : items.some((item) => item.id === tab) ? tab! : "board",
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [items]);
  return (
    <section className="grid min-w-0 gap-3">
      <p className="text-sm text-muted-foreground">
        Choose a section. Your submission draft stays on this page when you switch views.
      </p>
      <UntitledTabs
        label="Tournament sections"
        keepMounted
        selectedKey={selected}
        disabled={!ready}
        onSelectionChange={(key) => {
          setSelected(key);
          const url = new URL(window.location.href);
          url.searchParams.set("tab", key);
          url.searchParams.delete("submission");
          window.history.pushState(null, "", url.pathname + url.search);
        }}
        items={items}
      />
    </section>
  );
}
