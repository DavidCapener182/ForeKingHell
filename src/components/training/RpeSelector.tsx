"use client";

import { useState } from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type RpeSelectorProps = {
  name?: string;
  defaultValue?: number;
  idPrefix?: string;
  compact?: boolean;
};

const rpeDescriptions = [
  "Very easy / light putting",
  "Casual putting or short practice",
  "Easy range session",
  "Normal practice",
  "18-hole round in cart",
  "18-hole walking round or focused session",
  "Hard practice or competitive round",
  "Tournament, hilly walk or high pressure",
  "Very hard speed or technical session",
  "Max effort speed training / long intense session",
];

export function RpeSelector({
  name = "rpe",
  defaultValue = 5,
  idPrefix = "rpe",
  compact = false,
}: RpeSelectorProps) {
  const [value, setValue] = useState(String(defaultValue));

  return (
    <fieldset className="grid gap-2">
      <legend
        className={
          compact
            ? "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            : "text-sm font-semibold text-foreground"
        }
      >
        {compact ? "Edit RPE" : "How demanding was this session overall?"}
      </legend>
      {!compact ? (
        <p className="text-sm leading-5 text-muted-foreground">
          Consider physical effort, mental pressure, weather, walking, repetition and how tired your
          swing felt at the end.
        </p>
      ) : null}
      <input type="hidden" name={name} value={value} />
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(nextValue) => {
          if (nextValue) setValue(nextValue);
        }}
        aria-label="Rate perceived exertion"
        className={cn(
          "grid h-auto gap-2 bg-transparent p-0",
          compact
            ? "grid-cols-5 2xl:grid-cols-10"
            : "grid-cols-2 sm:grid-cols-5 min-[1700px]:grid-cols-10",
        )}
      >
        {rpeDescriptions.map((description, index) => {
          const value = index + 1;
          const id = `${idPrefix}-${value}`;

          return (
            <ToggleGroupItem
              key={value}
              value={String(value)}
              id={id}
              aria-label={`RPE ${value}: ${description}`}
              className={cn(
                "grid h-auto content-start gap-1 rounded-lg border border-border bg-card p-2 text-left shadow-sm hover:border-primary/60 hover:bg-accent/60 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground data-[state=on]:ring-2 data-[state=on]:ring-ring/20",
                compact ? "min-h-12 place-items-center text-center" : "min-h-24",
              )}
            >
              <span className="text-lg font-semibold tracking-normal text-foreground">{value}</span>
              {!compact ? (
                <span className="text-xs leading-4 text-muted-foreground">{description}</span>
              ) : null}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </fieldset>
  );
}
