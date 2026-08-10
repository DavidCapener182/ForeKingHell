import { Save } from "lucide-react";
import type { ReactNode } from "react";

import { createGolfTrainingSessionAction } from "@/app/stats/training-over-time/actions";
import { RpeSelector } from "@/components/training/RpeSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TrainingSessionFormProps = {
  rangeKey: string;
  today: string;
  idPrefix?: string;
};

export function TrainingSessionForm({
  rangeKey,
  today,
  idPrefix = "training-load",
}: TrainingSessionFormProps) {
  return (
    <form action={createGolfTrainingSessionAction} className="grid gap-4 p-4">
      <input type="hidden" name="range" value={rangeKey} />
      <div className="grid gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
        <Field label="Activity type">
          <select
            name="activityType"
            defaultValue="range"
            className="min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="round">Round</option>
            <option value="range">Range</option>
            <option value="short_game">Short game</option>
            <option value="putting">Putting</option>
            <option value="gym_speed">Gym / speed</option>
            <option value="manual">Manual</option>
          </select>
        </Field>
        <Field label="Date">
          <Input
            name="sessionDate"
            type="date"
            defaultValue={today}
            required
            className="min-h-11"
          />
        </Field>
        <Field label="Title">
          <Input
            name="title"
            placeholder="Range block, walking round, speed session..."
            className="min-h-11"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Duration minutes">
          <Input name="durationMinutes" inputMode="numeric" placeholder="60" className="min-h-11" />
        </Field>
        <Field label="Holes played">
          <Input
            name="holesPlayed"
            inputMode="numeric"
            placeholder="9 or 18"
            className="min-h-11"
          />
        </Field>
        <Field label="Total swings">
          <Input name="totalSwings" inputMode="numeric" placeholder="80" className="min-h-11" />
        </Field>
        <Field label="Full swings">
          <Input name="fullSwings" inputMode="numeric" placeholder="45" className="min-h-11" />
        </Field>
        <Field label="Short-game swings">
          <Input name="shortGameSwings" inputMode="numeric" placeholder="25" className="min-h-11" />
        </Field>
        <Field label="Putting strokes">
          <Input name="puttingSwings" inputMode="numeric" placeholder="30" className="min-h-11" />
        </Field>
        <Field label="Round movement">
          <select
            name="movement"
            defaultValue=""
            className="min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Not relevant</option>
            <option value="walked">Walked</option>
            <option value="cart">Cart</option>
          </select>
        </Field>
        <Field label="Pressure">
          <select
            name="mentalPressure"
            defaultValue=""
            className="min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Optional</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <RpeSelector idPrefix={`${idPrefix}-rpe`} defaultValue={5} />
        <div className="grid content-start gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground">
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="competition" className="size-4" />
            Competition or high-consequence practice
          </label>
          <Field label="Physical demand">
            <select
              name="physicalDemand"
              defaultValue=""
              className="min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Optional</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs leading-5 text-muted-foreground">
            The app calculates session load from volume, RPE and golf context. It may suggest when
            to reduce load, but it does not diagnose medical or injury issues.
          </p>
        </div>
      </div>

      <Field label="Notes">
        <Textarea
          name="notes"
          placeholder="Weather, walking load, pressure, how heavy the swing felt, or what the practice block targeted."
          className="min-h-24"
        />
      </Field>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button type="submit" className="premium-action min-h-11 w-full sm:w-auto">
          <Save className="size-4" />
          Save Training Load
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
