"use client";
import type { FlightEvidence } from "@/lib/session-data-confidence";
import { DirectionReviewControls } from "./session-confidence-controls";
export function ShotFlightEvidence({
  evidence,
  sessionId,
  shotId,
}: {
  evidence: FlightEvidence;
  sessionId: string;
  shotId: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3" aria-label="Flight evidence">
      <h3 className="text-sm font-semibold">
        Flight evidence · {evidence.directionConfidence} direction confidence
      </h3>
      <p className="mt-2 text-sm">
        {evidence.endpointSource === "source_reported"
          ? "Source-reported endpoint"
          : evidence.endpointSource === "unavailable"
            ? "Endpoint unavailable"
            : "Endpoint provenance unverified"}
      </p>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-muted-foreground">
        {evidence.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {evidence.faceToPathDeg !== null && (
        <p className="mt-2 text-sm">
          {evidence.faceSource === "modelled" ? "Modelled face-to-path" : "Face-to-path"}:{" "}
          {evidence.faceToPathDeg.toFixed(1)}°
        </p>
      )}
      <DirectionReviewControls
        sessionId={sessionId}
        shotId={shotId}
        status={evidence.reviewStatus}
      />
    </section>
  );
}
