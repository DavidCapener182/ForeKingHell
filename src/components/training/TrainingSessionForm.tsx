import { Save } from "lucide-react";
import type { ReactNode } from "react";

import { createGolfTrainingSessionAction } from "@/app/stats/training-over-time/actions";
import { RpeSelector } from "@/components/training/RpeSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
          <Select name="activityType" defaultValue="range">
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="round">Round</SelectItem>
              <SelectItem value="range">Range</SelectItem>
              <SelectItem value="short_game">Short game</SelectItem>
              <SelectItem value="putting">Putting</SelectItem>
              <SelectItem value="gym_speed">Gym / speed</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
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
          <Select name="movement">
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue placeholder="Not relevant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walked">Walked</SelectItem>
              <SelectItem value="cart">Cart</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Pressure">
          <Select name="mentalPressure">
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <RpeSelector idPrefix={`${idPrefix}-rpe`} defaultValue={5} />
        <div className="grid content-start gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground">
          <div className="flex min-h-11 items-center gap-2">
            <Switch id={`${idPrefix}-competition`} name="competition" />
            <Label htmlFor={`${idPrefix}-competition`}>
              Competition or high-consequence practice
            </Label>
          </div>
          <Field label="Physical demand">
            <Select name="physicalDemand">
              <SelectTrigger className="min-h-11 w-full">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
