"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, Globe2, Medal, Trophy, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type LeaderboardTab = "friends" | "monthly" | "courses" | "challenges" | "tournaments" | "public";
type LeaderboardPeriod = "all-time" | "monthly";

const tabs: Array<{
  value: Exclude<LeaderboardTab, "monthly">;
  label: string;
  icon: typeof Users;
}> = [
  { value: "friends", label: "Friends", icon: Users },
  { value: "public", label: "Global", icon: Globe2 },
  { value: "courses", label: "Course", icon: Medal },
  { value: "challenges", label: "Challenge", icon: Trophy },
  { value: "tournaments", label: "Tournament", icon: Flag },
];

export function LeaderboardTypeTabs({
  activeTab,
  period,
}: {
  activeTab: LeaderboardTab;
  period: LeaderboardPeriod;
}) {
  const selectedTab = activeTab === "monthly" ? "friends" : activeTab;

  return (
    <Tabs value={selectedTab} data-leaderboard-type-tabs>
      <TabsList
        variant="line"
        aria-label="Leaderboard views"
        className="h-auto max-w-full justify-start overflow-x-auto border-b border-border px-0 pb-2"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.value === selectedTab;
          const keepPeriod = tab.value === "friends" || tab.value === "public";
          const href = `/leaderboard?tab=${tab.value}${keepPeriod && period === "monthly" ? "&period=monthly" : ""}`;

          return (
            <TabsTrigger key={tab.value} value={tab.value} asChild>
              <Link href={href} prefetch={false} aria-current={active ? "page" : undefined}>
                <Icon aria-hidden />
                {tab.label}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

export function LeaderboardPlayerControls({
  activeTab,
  period,
  monthLabel,
  provider,
  verification,
}: {
  activeTab: "friends" | "monthly" | "public";
  period: LeaderboardPeriod;
  monthLabel: string;
  provider: string;
  verification: string;
}) {
  const router = useRouter();

  function updateQuery(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === "all" || value === "all-time") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    router.push(`/leaderboard?${params.toString()}`);
  }

  return (
    <section
      className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3"
      data-leaderboard-player-controls
    >
      <ControlGroup label="Period">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={period}
          onValueChange={(value) => {
            if (!value) return;
            updateQuery({ period: value });
          }}
          aria-label="Leaderboard period"
        >
          <ToggleGroupItem value="all-time">All time</ToggleGroupItem>
          <ToggleGroupItem value="monthly">This month</ToggleGroupItem>
        </ToggleGroup>
      </ControlGroup>

      <ControlGroup label="Scope">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={activeTab === "public" ? "global" : "friends"}
          onValueChange={(value) => {
            if (!value) return;
            updateQuery({ tab: value === "global" ? "public" : "friends" });
          }}
          aria-label="Leaderboard scope"
        >
          <ToggleGroupItem value="friends">Friends</ToggleGroupItem>
          <ToggleGroupItem value="global">Global</ToggleGroupItem>
        </ToggleGroup>
      </ControlGroup>

      <ControlGroup label="Source">
        <Select value={provider} onValueChange={(value) => updateQuery({ provider: value })}>
          <SelectTrigger size="sm" aria-label="Leaderboard source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="espn">ESPN</SelectItem>
            <SelectItem value="rapsodo">Rapsodo file</SelectItem>
            <SelectItem value="rapsodo_cloud">Rapsodo Cloud</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </ControlGroup>

      <ControlGroup label="Proof">
        <Select
          value={verification}
          onValueChange={(value) => updateQuery({ verification: value })}
        >
          <SelectTrigger size="sm" aria-label="Leaderboard proof status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All evidence</SelectItem>
            <SelectItem value="verified">Verified only</SelectItem>
            <SelectItem value="manual">Manual only</SelectItem>
          </SelectContent>
        </Select>
      </ControlGroup>

      <Badge variant="secondary" className="ml-auto">
        {period === "monthly" ? monthLabel : "All recorded results"}
      </Badge>
    </section>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
