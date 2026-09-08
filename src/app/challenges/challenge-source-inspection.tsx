import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { getChallengeSourceInspection } from "@/lib/challenges";

export function ChallengeSourceInspection({
  challengeId,
  data,
}: {
  challengeId: string;
  data: Awaited<ReturnType<typeof getChallengeSourceInspection>>;
}) {
  const href = (page: number) =>
    `/challenges/${challengeId}?tab=attempts&sourcePage=${page}#source-inspection`;
  return (
    <section id="source-inspection" className="grid min-w-0 gap-3 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">Your source eligibility</h2>
      <p className="text-sm text-muted-foreground">
        Your saved shot history assessed against this challenge’s rules. This is not a record of
        submitted or rejected attempts. Only your sources are shown. Eligible measurements still
        need the challenge’s minimum sample and aggregate scoring rules; they do not individually
        establish a ranked result.
      </p>
      <p role="status">
        {data.total} saved sources · Page {data.page} of {data.pages}
      </p>
      {data.rows.length ? (
        data.rows.map((row) => (
          <details
            key={row.id}
            data-challenge-source={row.id}
            className="min-w-0 rounded-lg border p-3"
          >
            <summary className="min-h-11 cursor-pointer content-center break-words font-medium">
              {row.clubType ?? "Unknown club"} ·{" "}
              {row.eligible ? "Eligible measurement" : "Not qualifying"} ·{" "}
              {row.shotAt.toISOString().slice(0, 10)}
            </summary>
            <dl className="mt-3 grid gap-2 text-sm">
              <div>
                <dt className="font-medium">Source</dt>
                <dd className="break-words">{row.source.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="font-medium">Shot time (UTC)</dt>
                <dd>{row.shotAt.toISOString()}</dd>
              </div>
              <div>
                <dt className="font-medium">Carry / total (yd)</dt>
                <dd>
                  {row.carryYd ?? "Not recorded"} / {row.totalYd ?? "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Offline (yd) / direction (°)</dt>
                <dd>
                  {row.sideCarryYd ?? "Not recorded"} / {row.launchDirectionDeg ?? "Not recorded"}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Review status</dt>
                <dd>{row.reviewStatus.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="font-medium">Eligibility</dt>
                <dd>
                  {row.reasons.length ? (
                    <ul className="list-disc pl-5">
                      {row.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    "Meets source, time, club and measurement checks. See your qualifying aggregate above."
                  )}
                </dd>
              </div>
            </dl>
            <Button asChild variant="outline" className="mt-3 min-h-11">
              <Link href={`/sessions/${row.sessionId}`}>Open source session</Link>
            </Button>
          </details>
        ))
      ) : (
        <p>No saved shot sources to inspect.</p>
      )}
      <nav aria-label="Source eligibility pages" className="flex flex-wrap gap-2">
        {data.page > 1 ? (
          <Button asChild variant="outline">
            <Link href={href(data.page - 1)} scroll={false}>
              Previous sources
            </Link>
          </Button>
        ) : null}
        {data.page < data.pages ? (
          <Button asChild variant="outline">
            <Link href={href(data.page + 1)} scroll={false}>
              Next sources
            </Link>
          </Button>
        ) : null}
      </nav>
    </section>
  );
}
