"use client";
import { useState } from "react";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientReady } from "@/hooks/use-client-ready";
import styles from "@/app/course-records/course-record-board.module.css";
type FilterValue = { type: string; club: string; tier: string; hide: boolean };
export function AchievementFilterControls({
  query,
  onQuery,
  values,
  options,
  onApply,
  onReset,
}: {
  query: string;
  onQuery: (value: string) => void;
  values: FilterValue;
  options: {
    type: Array<{ id: string; label: string }>;
    club: Array<{ id: string; label: string }>;
    tier: Array<{ id: string; label: string }>;
  };
  onApply: (value: FilterValue) => void;
  onReset: () => void;
}) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(values);
  const count =
    Number(values.type !== "all") +
    Number(values.club !== "all") +
    Number(values.tier !== "all") +
    Number(values.hide);
  function fields(value: FilterValue, change: (value: FilterValue) => void) {
    return (
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["type", "club", "tier"] as const).map((key) => (
          <label key={key} className="grid min-w-0 gap-1 text-sm font-medium">
            {key}
            <select
              disabled={!ready}
              aria-label={`Achievement ${key}`}
              className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3"
              value={value[key]}
              onChange={(event) => change({ ...value, [key]: event.target.value })}
            >
              <option value="all">All {key}s</option>
              {options[key].map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.hide}
            disabled={!ready}
            onChange={(event) => change({ ...value, hide: event.target.checked })}
          />
          Hide completed
        </label>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-medium">
        Search achievements
        <Input
          disabled={!ready}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Name, club or target"
        />
      </label>
      <div className={styles.desktop}>{fields(values, onApply)}</div>
      <div className="flex flex-wrap gap-2">
        <div className={styles.mobile}>
          <Button
            variant="outline"
            disabled={!ready}
            onClick={() => {
              setDraft(values);
              setOpen(true);
            }}
          >
            Filters ({count})
          </Button>
        </div>
        <Button variant="outline" disabled={!ready} onClick={onReset}>
          Clear all filters
        </Button>
      </div>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title="Achievement filters"
        description="Filter the catalogue without changing earned XP or unlocks."
      >
        <div className="grid gap-4 pb-4">
          {fields(draft, setDraft)}
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Apply filters
          </Button>
          <Button
            variant="outline"
            onClick={() => setDraft({ type: "all", club: "all", tier: "all", hide: false })}
          >
            Reset filters
          </Button>
        </div>
      </ResponsiveDetailPanel>
    </div>
  );
}
