import { DriverDevelopmentPanel } from "@/components/analysis/driver-development-panel";
import { resolveMobileSpeedSaveReceipt } from "@/lib/mobile-speed-save-receipt";
import Link from "next/link";
import { mobileSpeedPlanForTransfer } from "@/lib/mobile-speed-plan";
import { MobileSpeedTrend } from "@/components/speed/mobile-speed-trend";
import { MobileSpeedSession } from "./mobile-speed-session";
import { PageShell } from "@/components/premium";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import { getSpeedCentrePageData } from "@/lib/speed-training-data";
import { requireCurrentUserId } from "@/lib/current-user";
import styles from "./mobile-speed.module.css";

export default async function SpeedCompanionPage({
  error,
  saved,
  savedSessionId,
}: {
  error?: string | null;
  saved?: string | null;
  savedSessionId?: string | null;
}) {
  const accountId = await requireCurrentUserId();
  const data = await getSpeedCentrePageData(accountId);
  const { summary, development } = data;
  const savedReceipt =
    saved === "1" ? resolveMobileSpeedSaveReceipt(data.sessions, savedSessionId) : null;
  const linkedTransferFailed = development.verdict?.playabilityPassed === false;
  const playing = development.funnel.find((item) => item.key === "playing");
  const driver = data.clubOptions.find((club) => club.type === "driver");
  const speed = (value: number | null) => (value === null ? "—" : value.toFixed(1));
  return (
    <PageShell>
      <div className={styles.screen} data-mobile-speed>
        <MobileLargeTitle title="Speed" />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {savedReceipt || saved === "goals" || saved === "deleted" ? (
          <p role="status" className="text-sm text-primary">
            {saved === "goals"
              ? "Speed targets updated."
              : saved === "deleted"
                ? "Speed session deleted."
                : "Speed session saved."}
          </p>
        ) : null}
        <section className={styles.readout} aria-label="Your speed">
          <p className="mobile-type-headline">Playing speed</p>
          <p className={styles.playingNumber}>
            {speed(playing?.valueMph ?? null)}
            <span>mph</span>
          </p>
          <dl className={styles.metrics}>
            {[
              { label: "Verified PB", value: summary.personalBestMph },
              { label: "7-day average", value: summary.sevenDayAvgMph },
              { label: "Target", value: summary.targetSpeedMph },
            ].map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>
                  {speed(item.value)}
                  {item.value !== null ? <span>mph</span> : null}
                </dd>
              </div>
            ))}
          </dl>
          <details className={styles.evidence}>
            <summary>Playing speed evidence</summary>
            <p>{playing?.source ?? "Measured playable ball evidence needed"}</p>
            <p>
              {linkedTransferFailed
                ? development.verdict?.nextAction
                : development.chaos.nextAction}
            </p>
          </details>
        </section>
        <MobileSpeedSession
          plan={mobileSpeedPlanForTransfer(development)}
          recommendation={
            linkedTransferFailed
              ? (development.verdict?.nextAction ??
                "Rebuild Driver control before more maximum-speed work.")
              : development.readiness.recommendation
          }
          statusLabel={
            linkedTransferFailed ? "Linked transfer needs work" : development.chaos.label
          }
          statusTone={
            !linkedTransferFailed && development.chaos.status === "successful"
              ? "positive"
              : "attention"
          }
          clubId={driver?.id}
          accountId={accountId}
          savedReceipt={savedReceipt}
          personalBestMph={summary.personalBestMph}
        />
        {summary.carryProjection.targetCarryYd !== null ? (
          <section className={styles.carry} aria-label="Potential carry">
            <div>
              <p className="mobile-type-headline">Potential carry</p>
              <p className="mobile-type-footnote text-muted-foreground">
                Modelled · {summary.carryProjection.basis}
              </p>
            </div>
            <p>
              {Math.round(summary.carryProjection.targetCarryYd)}
              <span>yd</span>
            </p>
          </section>
        ) : null}
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
        <details className={styles.ladder}>
          <summary>
            Target ladder{" "}
            {development.ladder.nextLevelMph !== null ? (
              <span>Next · {development.ladder.nextLevelMph} mph</span>
            ) : null}
          </summary>
          <MobileGroupedList>
            {development.ladder.levels.map((level) => (
              <MobileListRow
                key={level.speedMph}
                label={`${level.speedMph} mph`}
                value={
                  level.state === "unlocked"
                    ? "Reached"
                    : level.state === "current"
                      ? "Current"
                      : "Ahead"
                }
                detail={`${level.qualifyingSessions} qualifying sessions · ${Math.round(level.progressPercent)}%`}
              />
            ))}
          </MobileGroupedList>
        </details>
        <MobileSection title="History">
          {!data.sessions.length ? (
            <p className="mobile-type-callout text-muted-foreground">
              Your saved speed sessions will appear here.
            </p>
          ) : null}
          <MobileGroupedList>
            {data.sessions.slice(0, 12).map((session) => (
              <MobileListRow
                key={session.id}
                label={session.title ?? session.implementLabel}
                value={`${speed(session.avgSpeedMph)} mph`}
                detail={`${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(session.sessionDateIso))} · ${session.implementLabel} · ${session.swingCount} swings`}
                href={`/speed/sessions/${session.id}`}
              />
            ))}
          </MobileGroupedList>
          <Link href="/practice?intent=speed" className="flex min-h-11 items-center text-primary">
            Plan speed practice
          </Link>
        </MobileSection>
      </div>
      <DriverDevelopmentPanel compact />
    </PageShell>
  );
}
