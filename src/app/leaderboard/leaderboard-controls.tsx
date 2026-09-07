"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
import styles from "@/app/course-records/course-record-board.module.css";
export function LeaderboardPlayerControls({
  activeTab,
  period,
  monthLabel,
  provider,
  verification,
  query,
  resultCount,
  sort,
  dir,
}: {
  activeTab: "friends" | "monthly" | "public";
  period: "all-time" | "monthly";
  monthLabel: string;
  provider: string;
  verification: string;
  query: string;
  resultCount: number;
  sort: string;
  dir: string;
}) {
  const router = useRouter();
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    tab: activeTab,
    period,
    provider,
    verification,
    q: query,
    sort,
    dir,
  });
  function apply(reset = false) {
    const url = new URLSearchParams(window.location.search);
    const next = reset
      ? { tab: "friends", period: "all-time", provider: "all", verification: "all", q: "" }
      : draft;
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") url.delete(key);
      else url.set(key, value);
    }
    if (reset) {
      url.delete("sort");
      url.delete("dir");
    }
    setOpen(false);
    router.push(`/leaderboard?${url}`);
  }
  const fields = (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(
        [
          [
            "sort",
            "Sort by",
            [
              ["rank", "Rank"],
              ["player", "Player"],
              ["total-xp", "Total XP"],
              ["monthly-xp", "Monthly XP"],
              ["monthly-shots", "Monthly shots"],
              ["best-round", "Best round"],
              ["longest-drive", "Longest drive"],
              ["source", "Source"],
            ],
          ],
          [
            "dir",
            "Order",
            [
              ["asc", "Ascending"],
              ["desc", "Descending"],
            ],
          ],
          [
            "tab",
            "Scope",
            [
              ["friends", "Friends"],
              ["public", "Global"],
            ],
          ],
          [
            "period",
            "Period",
            [
              ["all-time", "All time"],
              ["monthly", monthLabel],
            ],
          ],
          [
            "provider",
            "Source",
            [
              ["all", "All sources"],
              ["espn", "ESPN"],
              ["rapsodo", "Rapsodo file"],
              ["rapsodo_cloud", "Rapsodo Cloud"],
              ["manual", "Manual"],
            ],
          ],
          [
            "verification",
            "Evidence",
            [
              ["all", "All evidence"],
              ["verified", "Verified only"],
              ["manual", "Manual only"],
            ],
          ],
        ] as const
      ).map(([key, label, options]) => (
        <label key={key} className="grid min-w-0 gap-1 text-sm font-medium">
          {label}
          <select
            disabled={!ready}
            aria-label={`Leaderboard ${label.toLowerCase()}`}
            className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
            value={draft[key]}
            onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
          >
            {options.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
  const count =
    Number(period !== "all-time") + Number(provider !== "all") + Number(verification !== "all");
  return (
    <section
      className="grid min-w-0 gap-3 rounded-xl border bg-card p-4"
      data-leaderboard-player-controls
    >
      <p role="status" className="text-sm">
        {resultCount} golfers · {activeTab === "public" ? "Global" : "Friends"} ·{" "}
        {period === "monthly" ? monthLabel : "All time"} · Ranking:{" "}
        {period === "monthly" ? "Monthly" : "Total"} XP
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
        className="grid gap-3"
      >
        <label className="grid gap-1 text-sm font-medium">
          Search golfers
          <Input
            disabled={!ready}
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
            placeholder="Name in loaded standings"
          />
        </label>
        <div className={styles.desktop}>{fields}</div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!ready}>
            Apply filters
          </Button>
          <Button type="button" variant="outline" disabled={!ready} onClick={() => apply(true)}>
            Clear all
          </Button>
          <div className={styles.mobile}>
            <Button type="button" variant="outline" disabled={!ready} onClick={() => setOpen(true)}>
              Filters ({count})
            </Button>
          </div>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        Source: {provider} · Evidence: {verification}. Search filters loaded standings and preserves
        original ranks; public results are limited to the first 100 public profile candidates.
      </p>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title="Leaderboard filters"
        description="Choose the same audience, period and evidence controls available on desktop."
      >
        <div className="grid gap-4 pb-4">
          {fields}
          <Button onClick={() => apply()}>Apply</Button>
          <Button
            variant="outline"
            onClick={() =>
              setDraft({ ...draft, period: "all-time", provider: "all", verification: "all" })
            }
          >
            Reset filters
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </section>
  );
}
