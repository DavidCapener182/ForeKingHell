"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { getDirectionAttention } from "@/lib/direction-attention";

export function DirectionAttention({
  data,
}: {
  data: Awaited<ReturnType<typeof getDirectionAttention>>;
}) {
  const [query, setQuery] = useState("");
  const visible = data.sessions.filter((session) =>
    session.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section
      aria-labelledby="direction-attention-title"
      className="grid min-w-0 gap-3 rounded-xl border bg-card p-4"
    >
      <div>
        <h3 id="direction-attention-title" className="text-lg font-semibold">
          Direction evidence to review
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.totalSessions} {data.totalSessions === 1 ? "session needs" : "sessions need"} a
          direction review. These warnings do not exclude valid carry or speed measurements.
        </p>
        {data.totalSessions > data.sessions.length ? (
          <p className="mt-2 text-sm">
            Showing the newest {data.sessions.length} of {data.totalSessions} sessions. Search
            covers this loaded list.
          </p>
        ) : null}
      </div>
      {data.sessions.length ? (
        <label className="grid gap-1 text-sm font-medium">
          Search direction reviews
          <Input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      ) : null}
      {data.sessions.length ? (
        <p role="status" className="text-sm">
          {visible.length} matching sessions
        </p>
      ) : (
        <p className="text-sm">No saved alignment or questionable-direction flags need review.</p>
      )}
      <ul className="grid min-w-0 gap-3 md:grid-cols-2">
        {visible.map((session) => (
          <li key={session.id} className="grid min-w-0 content-start gap-2 rounded-lg border p-3">
            <p className="break-words font-medium">{session.label}</p>
            <time dateTime={session.date} className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(
                new Date(session.date),
              )}
            </time>
            <p className="text-sm">
              {session.alignmentNeedsReview
                ? "Session alignment needs review."
                : "No session alignment warning."}{" "}
              {session.questionableShots}{" "}
              {session.questionableShots === 1 ? "shot has" : "shots have"} a questionable-direction
              flag.
            </p>
            <Button asChild variant="outline" className="min-h-11 h-auto whitespace-normal">
              <Link href={session.href}>Review session: {session.label}</Link>
            </Button>
          </li>
        ))}
      </ul>
      {data.sessions.length > 0 && visible.length === 0 ? (
        <p>No direction reviews match this search. Clear the search to see the loaded sessions.</p>
      ) : null}
    </section>
  );
}
