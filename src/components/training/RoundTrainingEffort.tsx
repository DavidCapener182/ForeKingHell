"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRoundTrainingEffortAction } from "@/app/stats/training-over-time/actions";
import type { TrainingSessionListItem } from "@/lib/training/trainingData";
import { ROUND_LOAD_MODEL, roundLoadExplanation } from "@/lib/training/roundLoad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RoundTrainingEffort({ sessions }: { sessions: TrainingSessionListItem[] }) {
  const rounds = sessions.filter((s) => s.loadMetadataJson?.model === ROUND_LOAD_MODEL).slice(0, 8);
  if (!rounds.length) return null;
  return (
    <section className="w-full rounded-xl border bg-card p-5" aria-label="Round training effort">
      <h2 className="text-xl font-semibold">Your rounds count too</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Completed real rounds are added automatically. Load uses minutes × overall effort. Missing
        values use an estimate: 4 hours per 18 holes and effort 3/10. These are app workload units;
        score does not change the load.
      </p>
      <div className="mt-4 divide-y">
        {rounds.map((session) => (
          <RoundEffortRow key={session.id} session={session} />
        ))}
      </div>
    </section>
  );
}
function RoundEffortRow({ session }: { session: TrainingSessionListItem }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <details className="py-3">
      <summary className="cursor-pointer text-sm">
        <span className="font-semibold">{session.title}</span> · {session.sessionDate} ·{" "}
        {session.sessionLoad.toLocaleString("en-GB")} load{" "}
        <span className="text-muted-foreground">— {roundLoadExplanation(session)} Edit effort</span>
      </summary>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        action={(formData) =>
          startTransition(async () => {
            setMessage("");
            const result = await updateRoundTrainingEffortAction(formData);
            setMessage(result.ok ? "Round effort saved. Training load updated." : result.error);
            if (result.ok) router.refresh();
          })
        }
      >
        <input type="hidden" name="trainingSessionId" value={session.id} />
        <label className="grid gap-1 text-sm">
          Round duration (minutes)
          <Input
            name="durationMinutes"
            type="number"
            min="1"
            max="1440"
            defaultValue={session.durationMinutes ?? ""}
            placeholder="Unknown"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Overall effort (1–10)
          <Input
            name="rpe"
            type="number"
            min="1"
            max="10"
            defaultValue={session.loadMetadataJson?.rpeEstimated === false ? session.rpe : ""}
            placeholder="Unknown — estimate 3"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Getting around
          <select
            name="movement"
            defaultValue={session.loadMetadataJson?.movement ?? "unknown"}
            className="min-h-10 rounded-md border bg-background px-3 text-foreground"
          >
            <option value="unknown">Not recorded</option>
            <option value="carry">Walked — carried bag</option>
            <option value="trolley">Walked — trolley</option>
            <option value="cart">Rode in a buggy</option>
          </select>
        </label>
        <Button className="self-end" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save round effort"}
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">
          Rate the whole round, including walking and carrying. Movement is context, so it is not
          multiplied into the load again. Leave unknown fields blank to keep them labelled as
          estimated.
        </p>
        {message ? (
          <p role="status" className="text-sm sm:col-span-2 xl:col-span-4">
            {message}
          </p>
        ) : null}
      </form>
    </details>
  );
}
