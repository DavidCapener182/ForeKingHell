import Link from "next/link";
import { mobileSpeedPlanForTransfer } from "@/lib/mobile-speed-plan";
import { MobileSpeedTrend } from "@/components/speed/mobile-speed-trend";
import { MobileSpeedSession } from "./mobile-speed-session";
import { PageShell } from "@/components/premium";
import { MobileLargeTitle, MobileMetric, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow, MobileStatus } from "@/components/app/mobile-primitives";
import { getSpeedCentrePageData } from "@/lib/speed-training-data";
import { requireCurrentUserId } from "@/lib/current-user";

export default async function SpeedCompanionPage({
  error,
  saved,
}: {
  error?: string | null;
  saved?: string | null;
}) {
  const accountId = await requireCurrentUserId();
  const data = await getSpeedCentrePageData(accountId);
  const { summary, development } = data;
  const linkedTransferFailed = development.verdict?.playabilityPassed === false;
  const playing = development.funnel.find((item) => item.key === "playing");
  const driver = data.clubOptions.find((club) => club.type === "driver");
  const speed = (value: number | null) => (value === null ? "—" : value.toFixed(1));
  return (
    <PageShell>
      <div className="grid gap-6" data-mobile-speed>
        <MobileLargeTitle
          title="Speed"
          detail={
            linkedTransferFailed
              ? "Rebuild Driver control before more maximum-speed work."
              : development.readiness.recommendation
          }
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-primary">
            Speed session saved.
          </p>
        ) : null}
        <MobileMetric
          value={speed(playing?.valueMph ?? null)}
          unit="mph"
          label="playing speed"
          detail={playing?.source ?? "Measured playable ball evidence needed"}
        />
        <div className="mobile-metric-strip">
          <MobileMetric value={speed(summary.personalBestMph)} unit="mph" label="verified PB" />
          <MobileMetric value={speed(summary.sevenDayAvgMph)} unit="mph" label="7-day average" />
          <MobileMetric value={speed(summary.targetSpeedMph)} unit="mph" label="target" />
        </div>
        <MobileStatus
          label={linkedTransferFailed ? "Linked transfer needs work" : development.chaos.label}
          tone={
            !linkedTransferFailed && development.chaos.status === "successful"
              ? "positive"
              : "attention"
          }
        />
        <p className="text-sm">
          {linkedTransferFailed ? development.verdict?.nextAction : development.chaos.nextAction}
        </p>
        {summary.carryProjection.targetCarryYd !== null ? (
          <MobileMetric
            value={Math.round(summary.carryProjection.targetCarryYd)}
            unit="yd"
            label="potential carry"
            detail={`Modelled · ${summary.carryProjection.basis}`}
          />
        ) : null}
        <MobileSpeedSession
          plan={mobileSpeedPlanForTransfer(development)}
          clubId={driver?.id}
          accountId={accountId}
          saved={saved === "1"}
          personalBestMph={summary.personalBestMph}
        />
        {development.verdict ? (
          <MobileSection title="Latest review">
            <MobileGroupedList>
              <MobileListRow
                label={
                  development.verdict.playabilityPassed === false
                    ? "Transfer needs work"
                    : development.verdict.playabilityPassed === true
                      ? "Linked corridor test passed"
                      : "Check ball transfer"
                }
                detail={development.verdict.label}
                href={`/speed/sessions/${development.verdict.sessionId}`}
              />
            </MobileGroupedList>
          </MobileSection>
        ) : null}
        <MobileSpeedTrend sessions={data.sessions} />
        <MobileSection title="Target ladder">
          <MobileGroupedList>
            {development.ladder.levels.map((level) => (
              <MobileListRow
                key={level.speedMph}
                label={`${level.speedMph} mph`}
                value={level.state}
                detail={`${level.qualifyingSessions} qualifying sessions · ${Math.round(level.progressPercent)}%`}
              />
            ))}
          </MobileGroupedList>
        </MobileSection>
        <MobileSection title="History">
          <MobileGroupedList>
            {data.sessions.slice(0, 12).map((session) => (
              <MobileListRow
                key={session.id}
                label={session.title ?? session.implementLabel}
                value={`${speed(session.avgSpeedMph)} mph`}
                detail={`${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(session.sessionDateIso))} · ${session.swingCount} swings`}
                href={`/speed/sessions/${session.id}`}
              />
            ))}
          </MobileGroupedList>
          <Link href="/practice?intent=speed" className="flex min-h-11 items-center text-primary">
            Plan speed practice
          </Link>
        </MobileSection>
      </div>
    </PageShell>
  );
}
