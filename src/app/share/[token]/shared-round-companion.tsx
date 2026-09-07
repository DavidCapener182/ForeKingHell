import Link from "next/link";
import { ArrowLeft, Link2 } from "lucide-react";

import type { SharedRoundData, SharedScorecardHole } from "@/app/share/[token]/page";
import {
  formatBoolean,
  formatDate,
  formatDateTime,
  formatNullableInteger,
  formatRatingSlope,
  integerFormatter,
} from "@/app/share/[token]/shared-round-format";
import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileStatusAction, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";
import { roundCompletionIssue } from "@/lib/round-context";
import { formatHandicapValue } from "@/lib/round-handicap";

export function SharedRoundCompanion({ round }: { round: SharedRoundData }) {
  return (
    <PageShell className="ios-public-auth pb-[max(2rem,env(safe-area-inset-bottom))] lg:pb-8">
      <MobileSharedRound round={round} />
    </PageShell>
  );
}

function MobileSharedRound({ round }: { round: SharedRoundData }) {
  const completeScore = roundCompletionIssue(round.holes) === null;
  const canShowDifferential = completeScore && [9, 18].includes(round.holes.length);
  const scoredHoles = round.holes.filter(
    (h) => typeof h.score === "number" && Number.isFinite(h.score),
  ).length;
  const recordedPutts = round.holes.filter(
    (h) => typeof h.putts === "number" && Number.isFinite(h.putts),
  ).length;
  const title = round.session.courseName ?? round.link.title ?? "Shared scorecard";

  return (
    <section className="ios-public-auth grid min-w-0 gap-5">
      <MobileTopBar
        title={title}
        leading={
          <Button asChild variant="ghost" size="icon" className="focus-aaa size-11 rounded-full">
            <Link href="/" aria-label={`Back to ${BRAND_NAME}`}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        }
      />
      <MobileStatusAction
        label={completeScore ? "Recorded score" : "Partial recorded score"}
        value={formatNullableInteger(round.totalScore)}
        detail={`${title} · ${formatDate(round.session.date)} · ${round.ownerName ?? `${BRAND_NAME} player`}`}
        action={<IOSInlineStatus label="Private link" tone="info" />}
      />

      <section className="grid gap-2" aria-label="Shared round summary">
        <IOSSectionHeader title="Round summary" description="Read-only scorecard evidence" />
        <IOSGroupedList label="Shared round metrics">
          <IOSListRow
            label="Par"
            value={formatNullableInteger(round.totalPar)}
            detail="Recorded round par"
          />
          <IOSListRow
            label="Putts"
            value={formatNullableInteger(round.totalPutts)}
            detail="Total recorded putts"
          />
          <IOSListRow
            label="Handicap differential"
            value={
              canShowDifferential
                ? formatHandicapValue(round.handicapDifferential)
                : "Needs complete scorecard"
            }
            detail="Estimate from the shared scorecard and tee data"
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-label="Shared hole scores">
        <IOSSectionHeader
          title="Scorecard"
          description={`${round.holes.length} recorded holes. Scroll the scorecard to see all fields; hole identity stays pinned.`}
        />
        <p role="status" className="text-sm leading-6">
          Current saved scorecard for this round only. {scoredHoles} of {round.holes.length} holes
          have a recorded score; {recordedPutts} have recorded putts. Missing values are not zero.
          {!completeScore
            ? " The partial score is not a final round result; a differential needs a complete scorecard."
            : ""}
        </p>
        <MobileSharedHoleRows holes={round.holes} />
      </section>

      <details className="rounded-xl border bg-card">
        <summary className="min-h-14 cursor-pointer px-4 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">
          Round details
        </summary>
        <IOSGroupedList label="Shared round detail rows" className="border-0">
          <IOSListRow label="Tee" value={round.session.teeName ?? "--"} />
          <IOSListRow
            label="Rating / slope"
            value={formatRatingSlope(round.session.courseRating, round.session.slopeRating)}
          />
          <IOSListRow
            label="Status"
            value={
              round.session.roundStatus === "complete"
                ? "Marked completed"
                : round.session.roundStatus === "in_progress"
                  ? "In progress"
                  : (round.session.roundStatus ?? "Not recorded")
            }
          />
          <IOSListRow label="Conditions" value={round.weather.conditions ?? "--"} />
          <IOSListRow label="Wind" value={round.weather.wind ?? "--"} />
          <IOSListRow label="Temperature" value={round.weather.temperature ?? "--"} />
          {round.session.equipmentNotes ? (
            <IOSListRow label="Equipment" detail={round.session.equipmentNotes} />
          ) : null}
          <IOSListRow
            label="Link access"
            detail={
              round.link.expiresAt
                ? `Expires ${formatDateTime(round.link.expiresAt)}.`
                : "This private link has no expiry date."
            }
            status={<IOSInlineStatus label="Read only" tone="info" />}
          />
        </IOSGroupedList>{" "}
      </details>

      <IOSGroupedList label="Shared link privacy">
        <IOSListRow
          icon={Link2}
          label="Only this scorecard is shared"
          detail="Shot data and private account details are not exposed. The owner can revoke this link."
          status={<IOSInlineStatus label="Private read-only link" tone="positive" />}
        />
      </IOSGroupedList>
    </section>
  );
}

function MobileSharedHoleRows({ holes }: { holes: SharedScorecardHole[] }) {
  if (!holes.length) return <p role="status">No scorecard rows are saved for this shared round.</p>;
  return (
    <div
      role="region"
      aria-label="Shared scorecard table"
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-xl border focus-visible:outline-2 focus-visible:outline-primary"
    >
      <table className="w-full min-w-[640px] text-right text-sm [&_th]:p-3 [&_td]:p-3 [&_tr]:border-b">
        <caption className="sr-only">
          Shared round scorecard. FIR means fairway hit; GIR means green in regulation. Missing
          values are not zero.
        </caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-muted text-left">
              Hole
            </th>
            {["Par", "Yards", "Score", "Putts", "Penalties", "FIR", "GIR"].map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holes.map((hole) => (
            <tr key={hole.holeNumber}>
              <th scope="row" className="sticky left-0 bg-card text-left whitespace-nowrap">
                Hole {hole.holeNumber}
              </th>
              <td>{integerFormatter.format(hole.par)}</td>
              <td>{hole.yards > 0 ? integerFormatter.format(hole.yards) : "--"}</td>
              <td>{formatNullableInteger(hole.score)}</td>
              <td className="whitespace-nowrap">
                {formatNullableInteger(hole.putts)}
                {hole.puttsSource === "manual" ? " · manual" : ""}
              </td>
              <td>{formatNullableInteger(hole.penalties)}</td>
              <td>{formatBoolean(hole.fairwayHit)}</td>
              <td>{formatBoolean(hole.gir)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
