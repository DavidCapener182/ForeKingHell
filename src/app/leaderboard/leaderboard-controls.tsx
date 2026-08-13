"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Flag, Globe2, Medal, Trophy, Users } from "lucide-react";

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

const tabs: Array<{
  value: LeaderboardTab;
  label: string;
  icon: typeof Users;
}> = [
  { value: "friends", label: "Friends", icon: Users },
  { value: "monthly", label: "Monthly", icon: CalendarDays },
  { value: "courses", label: "Course champions", icon: Medal },
  { value: "challenges", label: "Challenges", icon: Trophy },
  { value: "tournaments", label: "Tournaments", icon: Flag },
  { value: "public", label: "Public opt-in", icon: Globe2 },
];

export function LeaderboardTypeTabs({ activeTab }: { activeTab: LeaderboardTab }) {
  return (
    <Tabs value={activeTab} className="min-w-0" data-leaderboard-type-tabs>
      <TabsList variant="line" className="max-w-full justify-start overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <TabsTrigger key={tab.value} value={tab.value} asChild>
              <Link href={`/leaderboard?tab=${tab.value}`} prefetch={false}>
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
  monthLabel,
  provider,
  verification,
}: {
  activeTab: "friends" | "monthly" | "public";
  monthLabel: string;
  provider: string;
  verification: string;
}) {
  const router = useRouter();

  function updateQuery(updates: Record<string, string>) {
    const params = new URLSearchParams(window.location.search);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === "all") {
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
          value={activeTab === "monthly" ? "monthly" : "all-time"}
          onValueChange={(value) => {
            if (!value) return;
            updateQuery({
              tab: value === "monthly" ? "monthly" : activeTab === "public" ? "public" : "friends",
            });
          }}
          aria-label="Leaderboard period"
        >
          <ToggleGroupItem value="all-time">All time</ToggleGroupItem>
          <ToggleGroupItem value="monthly">This month</ToggleGroupItem>
        </ToggleGroup>
      </ControlGroup>

      <ControlGroup label="Audience">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={activeTab === "public" ? "global" : "friends"}
          onValueChange={(value) => {
            if (!value) return;
            updateQuery({ tab: value === "global" ? "public" : "friends" });
          }}
          aria-label="Leaderboard audience"
        >
          <ToggleGroupItem value="friends">Friends</ToggleGroupItem>
          <ToggleGroupItem value="global">Global opt-in</ToggleGroupItem>
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

      <ControlGroup label="Verification">
        <Select
          value={verification}
          onValueChange={(value) => updateQuery({ verification: value })}
        >
          <SelectTrigger size="sm" aria-label="Leaderboard verification">
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
        {activeTab === "monthly" ? monthLabel : "All recorded results"}
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
