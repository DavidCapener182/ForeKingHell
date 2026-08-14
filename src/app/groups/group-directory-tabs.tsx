import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type GroupDirectoryTab = "mine" | "discover" | "invites";

const tabs: Array<{ value: GroupDirectoryTab; label: string }> = [
  { value: "mine", label: "My Groups" },
  { value: "discover", label: "Discover" },
  { value: "invites", label: "Invites" },
];

export function GroupDirectoryTabs({
  activeTab,
  inviteCount,
}: {
  activeTab: GroupDirectoryTab;
  inviteCount: number;
}) {
  return (
    <Tabs value={activeTab}>
      <TabsList className="h-auto w-full justify-start bg-muted/70 p-1 sm:w-fit">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} asChild>
            <Link href={`/groups?tab=${tab.value}`} prefetch={false}>
              {tab.label}
              {tab.value === "invites" && inviteCount > 0 ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {inviteCount}
                </span>
              ) : null}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
