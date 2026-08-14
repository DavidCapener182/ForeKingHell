"use client";

import { useEffect, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProfileSection = "overview" | "workspaces" | "records" | "sharing";

const sections: Array<{ value: ProfileSection; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "workspaces", label: "Workspaces" },
  { value: "records", label: "Records" },
  { value: "sharing", label: "Sharing" },
];

export function ProfileSectionTabs() {
  const [active, setActive] = useState<ProfileSection>("overview");

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      if (
        hash === "workspaces" ||
        hash === "records" ||
        hash === "sharing" ||
        hash === "overview"
      ) {
        setActive(hash);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <Tabs value={active} onValueChange={(value) => setActive(value as ProfileSection)}>
      <TabsList className="h-auto w-full justify-start bg-muted/70 p-1">
        {sections.map((section) => (
          <TabsTrigger key={section.value} value={section.value} asChild>
            <a href={`#${section.value}`}>{section.label}</a>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
