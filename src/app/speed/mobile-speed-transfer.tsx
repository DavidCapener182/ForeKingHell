"use client";
import { useState } from "react";
import { SpeedForm } from "./speed-form";
import { saveSpeedTransferTestWithStateAction } from "./actions";
import type { SpeedSessionDetailPageData } from "@/lib/speed-training-data";

type Candidate = SpeedSessionDetailPageData["transferCandidates"][number];
export function MobileSpeedTransfer({
  sessionId,
  candidates,
  linkedSessionId,
  linkedShotIds,
}: {
  sessionId: string;
  candidates: Candidate[];
  linkedSessionId: string | null;
  linkedShotIds: string[];
}) {
  const [chosen, setChosen] = useState(
    linkedSessionId && candidates.some((c) => c.sessionId === linkedSessionId)
      ? linkedSessionId
      : (candidates[0]?.sessionId ?? ""),
  );
  return (
    <details>
      <summary className="flex min-h-12 items-center text-primary">
        {linkedSessionId ? "Change transfer evidence" : "Link five measured shots"}
      </summary>
      <div className="grid gap-4">
        <p className="mobile-type-callout text-muted-foreground">
          Choose the matching Driver session, then the exact five normal shots. Linking evidence
          checks transfer; completing an activity alone does not.
        </p>
        {candidates.length ? (
          <>
            <label className="grid gap-2 mobile-type-callout">
              Driver session
              <select
                className="min-h-12 w-full min-w-0 rounded-xl border bg-card px-3 text-base"
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
              >
                {candidates.map((c) => (
                  <option value={c.sessionId} key={c.sessionId}>
                    {new Date(c.sessionDateIso).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {c.label} · {c.eligibleShotCount} shots
                  </option>
                ))}
              </select>
            </label>
            {candidates.map((candidate) => (
              <div key={candidate.sessionId} hidden={candidate.sessionId !== chosen}>
                <ShotSelection
                  sessionId={sessionId}
                  candidate={candidate}
                  initialIds={candidate.sessionId === linkedSessionId ? linkedShotIds : []}
                />
              </div>
            ))}
          </>
        ) : (
          <p className="mobile-type-callout text-muted-foreground">
            No nearby Driver session has five eligible shots. Import the measured ball session
            first.
          </p>
        )}
        {linkedSessionId ? (
          <SpeedForm action={saveSpeedTransferTestWithStateAction} label="Remove transfer link">
            <input type="hidden" name="speedSessionId" value={sessionId} />
            <input type="hidden" name="shotSessionId" value="" />
            <p className="mobile-type-footnote text-muted-foreground">
              Removing this link keeps your speeds and raw Driver shots. The transfer verdict will
              become unlinked.
            </p>
          </SpeedForm>
        ) : null}
      </div>
    </details>
  );
}
function ShotSelection({
  sessionId,
  candidate,
  initialIds,
}: {
  sessionId: string;
  candidate: Candidate;
  initialIds: string[];
}) {
  const [selected, setSelected] = useState(
    initialIds.filter((id) => candidate.shots.some((s) => s.id === id)),
  );
  return (
    <SpeedForm
      action={saveSpeedTransferTestWithStateAction}
      label="Link selected five"
      disabled={selected.length !== 5}
    >
      <input type="hidden" name="speedSessionId" value={sessionId} />
      <input type="hidden" name="shotSessionId" value={candidate.sessionId} />
      <p role="status" aria-live="polite" className="mobile-type-callout tabular-nums">
        {selected.length} of 5 selected
      </p>
      <div className="divide-y rounded-xl bg-card px-3">
        {candidate.shots.map((shot, index) => (
          <label key={shot.id} className="flex min-h-14 items-center gap-3 py-2">
            <input
              type="checkbox"
              name="shotId"
              value={shot.id}
              checked={selected.includes(shot.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked ? [...ids, shot.id] : ids.filter((id) => id !== shot.id),
                )
              }
              className="size-5 shrink-0 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <strong className="mobile-type-callout">Shot {shot.shotNumber ?? index + 1}</strong>
              <span className="block mobile-type-footnote text-muted-foreground">
                {shot.sideCarryYd === null
                  ? "Side not measured"
                  : `${Math.abs(shot.sideCarryYd).toFixed(0)} yd ${shot.sideCarryYd < 0 ? "left" : "right"}`}
              </span>
            </span>
            <span className="mobile-type-headline tabular-nums">
              {shot.clubSpeedMph === null ? "—" : shot.clubSpeedMph.toFixed(1)}{" "}
              <small className="font-normal text-muted-foreground">mph</small>
            </span>
          </label>
        ))}
      </div>
    </SpeedForm>
  );
}
