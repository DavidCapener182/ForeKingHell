"use client";

import { useEffect, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type GroupSection = "overview" | "activity" | "members";

const sections: Array<{ value: GroupSection; label: string; href: string }> = [
  { value: "overview", label: "Overview", href: "#overview" },
  { value: "activity", label: "Activity", href: "#activity" },
  { value: "members", label: "Members", href: "#members" },
];

export function GroupSectionTabs() {
  const [active, setActive] = useState<GroupSection>("overview");

  useEffect(() => {
    const syncFromHash = () => {
      const value = window.location.hash.slice(1);
      if (value === "activity" || value === "members" || value === "overview") {
        setActive(value);
      }
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <Tabs value={active} onValueChange={(value) => setActive(value as GroupSection)}>
      <TabsList className="h-auto w-full justify-start bg-muted/70 p-1">
        {sections.map((section) => (
          <TabsTrigger key={section.value} value={section.value} asChild>
            <a href={section.href}>{section.label}</a>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
