import Link from "next/link";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { directionIsUsable, alignmentLabels, alignmentStatus } from "@/lib/session-data-confidence";
import type { TodayPracticeShot } from "@/lib/today-session-data";
export function TodayDataQuality({
  shots,
  compact = false,
}: {
  shots: TodayPracticeShot[];
  compact?: boolean;
}) {
  const affected = shots.filter((shot) => !directionIsUsable(shot.dataConfidence, shot.id));
  const sessions = [...new Map(affected.map((shot) => [shot.sessionId, shot])).values()];
  if (!affected.length && compact) return null;
  return (
    <Alert>
      <AlertTitle>
        {affected.length
          ? `${affected.length} shots have limited directional confidence`
          : "Directional evidence checks"}
      </AlertTitle>
      <AlertDescription>
        <p>
          {affected.length
            ? "Alignment or individual direction reviews limit lateral and curvature evidence. Valid carry, total and ball-speed readings remain available."
            : shots.length
              ? "No recorded alignment restriction affects these rows. Missing measurements remain unavailable; this does not prove the setup was checked."
              : "Import measured shots to inspect alignment and source evidence."}
        </p>
        {sessions.length ? (
          <details className="mt-2">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
              Affected sessions and review actions
            </summary>
            <ul className="grid gap-2">
              {sessions.map((shot) => (
                <li key={shot.sessionId} className="rounded-lg border border-border p-3">
                  <p className="break-words font-medium">
                    {shot.fileName ?? shot.courseName ?? "Measured session"}
                  </p>
                  <p>
                    {alignmentLabels[alignmentStatus(shot.dataConfidence?.alignment)]} ·{" "}
                    {affected.filter((row) => row.sessionId === shot.sessionId).length} affected
                    shots
                  </p>
                  <Link
                    className="inline-flex min-h-11 items-center font-medium text-primary underline"
                    href={`/sessions/${shot.sessionId}`}
                  >
                    Review source and alignment
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
