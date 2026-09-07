"use client";
import { useState } from "react";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
import { Button } from "@/components/ui/button";
export function ExperimentSelection({
  sessions,
  clubs,
  initialTest,
  initialBaseline,
  initialClub,
}: {
  sessions: Array<{ id: string; label: string; dateLabel: string; shotCount: number }>;
  clubs: Array<{ id: string; label: string; shotCount: number }>;
  initialTest: string;
  initialBaseline: string;
  initialClub: string;
}) {
  const [test, setTest] = useState(initialTest);
  const [baseline, setBaseline] = useState(initialBaseline);
  const [club, setClub] = useState(initialClub || "__all__");
  const options = [
    { value: "__choose__", label: "Choose a saved session" },
    ...sessions.map((s) => ({
      value: s.id,
      label: `${s.dateLabel} · ${s.label} · ${s.shotCount} shots`,
    })),
  ];
  const duplicate = Boolean(test && test === baseline);
  const ready =
    test && baseline && test !== "__choose__" && baseline !== "__choose__" && !duplicate;
  return (
    <form
      action="/equipment/experiments"
      className="grid gap-3 rounded-xl border bg-card p-4"
      onSubmit={(event) => {
        if (!ready) event.preventDefault();
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <UntitledSelect
          label="1. Current setup baseline"
          name="baselineSessionId"
          value={baseline || "__choose__"}
          onValueChange={setBaseline}
          options={options}
        />
        <UntitledSelect
          label="2. Test setup session"
          name="sessionId"
          value={test || "__choose__"}
          onValueChange={setTest}
          options={options}
        />
        <UntitledSelect
          label="3. Club scope"
          name="clubId"
          value={club}
          onValueChange={setClub}
          options={[
            { value: "__all__", label: "All clubs" },
            ...clubs.map((c) => ({ value: c.id, label: `${c.label} · ${c.shotCount} shots` })),
          ]}
        />
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Baseline: {options.find((s) => s.value === baseline)?.label ?? "not selected"}. Test:{" "}
        {options.find((s) => s.value === test)?.label ?? "not selected"}.
      </p>
      {duplicate && (
        <p role="alert" className="text-sm text-destructive">
          Choose two different sessions. A session cannot represent both setups.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!ready}>
          Compare setups
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setTest("");
            setBaseline("");
            setClub("__all__");
          }}
        >
          Reset selections
        </Button>
      </div>
    </form>
  );
}
