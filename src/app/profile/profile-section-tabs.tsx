"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProfileSection = "overview" | "achievements" | "records" | "sharing";

const sections: Array<{ value: ProfileSection; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "achievements", label: "Achievements" },
  { value: "records", label: "Records" },
  { value: "sharing", label: "Sharing" },
];

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
  const [active, setActive] = useState<ProfileSection>("overview");

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      if (
        hash === "achievements" ||
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

  function selectSection(value: string) {
    const section = value as ProfileSection;
    setActive(section);
    window.history.replaceState(null, "", `#${section}`);
  }

  return (
    <Tabs value={active} onValueChange={selectSection} className="min-w-0 gap-5">
      <div className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-background/92 px-1 py-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
        <TabsList
          variant="line"
          aria-label="Profile sections"
          className="h-11 min-w-full justify-start gap-4 border-b px-0 sm:gap-7"
        >
          {sections.map((section) => (
            <TabsTrigger
              key={section.value}
              value={section.value}
              className="h-11 flex-none px-0 text-[0.82rem] sm:text-sm"
            >
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview" id="overview" className="min-w-0">
        {overview}
      </TabsContent>
      <TabsContent value="achievements" id="achievements" className="min-w-0">
        {achievements}
      </TabsContent>
      <TabsContent value="records" id="records" className="min-w-0">
        {records}
      </TabsContent>
      <TabsContent value="sharing" id="sharing" className="min-w-0">
        {sharing}
      </TabsContent>
    </Tabs>
  );
}
