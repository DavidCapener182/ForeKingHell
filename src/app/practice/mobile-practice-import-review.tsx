"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PracticeImportOption } from "@/lib/practice-planner";
import { companionReviewRoute } from "@/lib/session-review-route";
import { linkPracticePlanSessionAction } from "./actions";

/** Confirm the evidence through the existing owned-plan scoring action. */
export function MobilePracticeImportReview({
  planId,
  sessions,
}: {
  planId: string;
  sessions: PracticeImportOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const session = sessions.find((item) => item.id === selected);
  if (!sessions.length) return <p>No measured imports are available yet.</p>;
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!session || pending) return;
        setMessage(null);
        startTransition(async () => {
          try {
            const result = await linkPracticePlanSessionAction(planId, session.id);
            if (!result.latestSessionReview) {
              setMessage("These shots could not review this plan. Choose another import.");
              return;
            }
            router.refresh();
          } catch {
            setMessage(
              "Could not review these shots. Your plan is unchanged; try again when connected.",
            );
          }
        });
      }}
    >
      <label htmlFor="practice-evidence-import" className="mobile-type-headline">
        Measured session
      </label>
      <select
        id="practice-evidence-import"
        className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        disabled={pending}
      >
        <option value="">Choose an import</option>
        {sessions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.dateLabel} · {item.label} · {item.shotCount} shots
          </option>
        ))}
      </select>
      {session ? (
        <Link
          className="flex min-h-11 items-center text-primary"
          href={companionReviewRoute({ id: session.id, type: session.sessionType })}
        >
          Inspect these shots
        </Link>
      ) : null}
      <Button type="submit" disabled={!session || pending}>
        {pending ? "Reviewing shots…" : "Use these measured shots"}
      </Button>
      {message ? (
        <p role="status" className="mobile-type-callout">
          {message}
        </p>
      ) : null}
    </form>
  );
}
