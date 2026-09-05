import Link from "next/link";
import { MobileLargeTitle, MobileMetric, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow, MobileStatus } from "@/components/app/mobile-primitives";
import { PageShell } from "@/components/premium";
import type { SpeedSessionDetailPageData } from "@/lib/speed-training-data";
import { MobileSpeedTransfer } from "./mobile-speed-transfer";
import { Button } from "@/components/ui/button";

export function SpeedSessionCompanion({
  data,
  saved,
  error,
}: {
  data: SpeedSessionDetailPageData;
  saved?: string | null;
  error?: string | null;
}) {
  const { session, peakSwingSummary: peak, transferTest: transfer } = data;
  const candidates = [...data.transferCandidates];
  const linkedId = transfer?.metadata.shotSessionId ?? null;
  if (transfer && linkedId && !candidates.some((c) => c.sessionId === linkedId))
    candidates.unshift({
      sessionId: linkedId,
      sessionDateIso: transfer.shots[0]?.shotAtIso ?? session.sessionDateIso,
      label: "Linked Driver session",
      eligibleShotCount: transfer.shots.length,
      shots: transfer.shots,
    });
  const format = (n: number | null) => (n === null ? "—" : n.toFixed(1));
  return (
    <PageShell>
      <div className="grid gap-6" data-mobile-speed-review>
        <MobileLargeTitle
          title={session.title ?? session.implementLabel}
          eyebrow={new Date(session.sessionDateIso).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          detail={`${session.implementLabel} · ${session.swingCount} readings`}
        />
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        {saved ? (
          <MobileStatus
            label={
              saved === "transfer"
                ? "Transfer evidence linked"
                : saved === "transfer_cleared"
                  ? "Transfer link removed"
                  : "Session saved"
            }
            tone="positive"
          />
        ) : null}
        <MobileMetric
          value={format(peak.bestSwingMph ?? session.maxSpeedMph)}
          unit="mph"
          label="session peak"
          detail="A speed ceiling; playable ball speed is checked separately."
        />
        <div className="mobile-metric-strip">
          <MobileMetric
            value={format(
              peak.medianSpeedMph ?? (peak.swingCount === 0 ? session.avgSpeedMph : null),
            )}
            unit="mph"
            label={peak.swingCount === 0 ? "saved average" : "median"}
          />
          <MobileMetric value={format(peak.bestThreeAvgMph)} unit="mph" label="top 3 average" />
        </div>
        <MobileSection title="Session verdict">
          <h2 className="mobile-type-title3">
            {peak.swingCount ? peak.trendLabel : "Summary readings saved"}
          </h2>
          <p className="mobile-type-callout text-muted-foreground">
            {transfer
              ? transfer.playability.status === "passed"
                ? "Your linked Driver test passed its lateral corridor check. Review strike and distance before using this speed on course."
                : transfer.playability.status === "failed"
                  ? "The linked Driver shots did not pass the corridor check. Rebuild normal control before chasing more speed."
                  : "The linked Driver test needs complete measured evidence."
              : "Ball transfer is not linked. A higher speed reading alone cannot establish better golf."}
          </p>
        </MobileSection>
        <MobileSection title="Ball transfer">
          <MobileStatus
            label={
              transfer
                ? transfer.playability.status === "passed"
                  ? "Corridor passed"
                  : transfer.playability.status === "failed"
                    ? "Corridor not passed"
                    : "Incomplete evidence"
                : "Not linked"
            }
            tone={transfer?.playability.status === "passed" ? "positive" : "attention"}
          />
          {transfer ? (
            <>
              <MobileMetric
                value={`${transfer.playability.inCorridorCount}/5`}
                label="inside the corridor"
                detail="The existing transfer rule requires four of five measured Driver shots."
              />
              <p className="mobile-type-footnote text-muted-foreground">
                {transfer.corridor.basis === "personal_80_percent"
                  ? `Central 80% of ${transfer.corridor.sampleSize} prior Driver shots.`
                  : "Provisional ±30 yd corridor; more prior measured Driver shots are needed."}{" "}
                Lateral position alone does not certify strike quality.
              </p>
              <details>
                <summary className="flex min-h-11 items-center text-primary">
                  Linked shot evidence
                </summary>
                <MobileGroupedList>
                  {transfer.shots.map((shot, i) => (
                    <MobileListRow
                      key={shot.id}
                      label={`Shot ${shot.shotNumber ?? i + 1}`}
                      value={`${format(shot.clubSpeedMph)} mph`}
                      detail={`${shot.sideCarryYd === null ? "Side unavailable" : `${Math.abs(shot.sideCarryYd).toFixed(0)} yd ${shot.sideCarryYd < 0 ? "left" : "right"}`} · ${shot.ballSpeedMph === null ? "Ball speed unavailable" : `${shot.ballSpeedMph.toFixed(1)} mph ball`}`}
                    />
                  ))}
                </MobileGroupedList>
              </details>
              <Link
                className="flex min-h-11 items-center text-primary"
                href={`/shots?sessionId=${linkedId}`}
              >
                View measured ball session
              </Link>
            </>
          ) : null}
          {data.canLinkTransferTest ? (
            <MobileSpeedTransfer
              sessionId={session.id}
              candidates={candidates}
              linkedSessionId={linkedId}
              linkedShotIds={transfer?.metadata.shotIds ?? []}
            />
          ) : (
            <p className="mobile-type-footnote text-muted-foreground">
              This implement/session does not support a Driver transfer link.
            </p>
          )}
          <Button asChild variant="outline" className="min-h-12">
            <Link href="/import">Import ball evidence</Link>
          </Button>
        </MobileSection>
        <MobileSection title="Swing readings">
          {data.swings.length ? (
            <details>
              <summary className="flex min-h-11 items-center text-primary">
                View {data.swings.length} measured readings
              </summary>
              <MobileGroupedList>
                {data.swings.map((swing) => (
                  <MobileListRow
                    key={swing.id}
                    label={`Swing ${swing.swingNumber}`}
                    value={`${swing.clubSpeedMph.toFixed(1)} mph`}
                    detail={`${swing.phase === "warm_up" ? "Warm-up / build" : swing.phase === "transfer" ? "Ball transfer" : "Maximum speed"}${swing.swingSide ? ` · ${swing.swingSide.replaceAll("_", " ")}` : ""}`}
                  />
                ))}
              </MobileGroupedList>
            </details>
          ) : (
            <p className="mobile-type-callout text-muted-foreground">
              Only summary numbers were saved. Individual swings cannot be reconstructed from an
              average.
            </p>
          )}
        </MobileSection>
        {session.notes ? (
          <MobileSection title="Session note">
            <p className="mobile-type-body whitespace-pre-wrap">{session.notes}</p>
          </MobileSection>
        ) : null}
        <MobileGroupedList>
          <MobileListRow label="Next speed session" href="/speed" />
          <MobileListRow
            label="Edit readings and equipment"
            detail="Desktop workbench"
            href={`/surface/workbench?next=${encodeURIComponent(`/speed/sessions/${session.id}`)}`}
          />
        </MobileGroupedList>
      </div>
    </PageShell>
  );
}
