"use client";
import { useEffect, useState, type ReactNode } from "react";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { useClientReady } from "@/hooks/use-client-ready";
export function ProfileSectionTabs({
  overview,
  achievements,
  records,
  sharing,
}: {
  overview: ReactNode;
  achievements: ReactNode;
  records: ReactNode;
  sharing: ReactNode;
}) {
  const ready = useClientReady();
  const [active, setActive] = useState("overview");
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      setActive(
        ["overview", "achievements", "records", "sharing"].includes(hash) ? hash : "overview",
      );
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  return (
    <section className="grid min-w-0 gap-3">
      <p className="text-sm text-muted-foreground">
        All four sections are available below. Scroll the tabs to reach Sharing.
      </p>
      <UntitledTabs
        label="Profile sections"
        selectedKey={active}
        disabled={!ready}
        keepMounted
        items={[
          { id: "overview", label: "Overview", content: overview },
          { id: "achievements", label: "Achievements", content: achievements },
          { id: "records", label: "Records", content: records },
          { id: "sharing", label: "Sharing", content: sharing },
        ]}
        onSelectionChange={(key) => {
          setActive(key);
          window.history.pushState(
            null,
            "",
            `${window.location.pathname}${window.location.search}#${key}`,
          );
        }}
      />
    </section>
  );
}
