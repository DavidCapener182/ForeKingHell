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
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { MobileAppShell, MobileStatusAction, MobileTopBar } from "@/components/mobile-sports";
import { PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { BRAND_NAME } from "@/lib/brand";
import { formatHandicapValue } from "@/lib/round-handicap";

export function SharedRoundCompanion({ round }: { round: SharedRoundData }) {
  return (
    <PageShell className="ios-public-auth pb-[max(2rem,env(safe-area-inset-bottom))] lg:pb-8">
      <MobileSharedRound round={round} />
    </PageShell>
  );
}

function MobileSharedRound({ round }: { round: SharedRoundData }) {
  const frontNine = round.holes.slice(0, 9);
  const remainingHoles = round.holes.slice(9);
  const title = round.session.courseName ?? round.link.title ?? "Shared scorecard";

  return (
    <MobileAppShell className="ios-public-auth">
      <MobileTopBar
        title="Shared round"
        leading={
          <Button asChild variant="ghost" size="icon" className="focus-aaa size-11 rounded-full">
            <Link href="/login" aria-label={`Back to ${BRAND_NAME}`}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        }
      />
      <MobileStatusAction
        label={round.session.roundStatus === "in_progress" ? "Round in progress" : "Final score"}
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
            value={formatHandicapValue(round.handicapDifferential)}
            detail="Estimate from the shared scorecard and tee data"
          />
        </IOSGroupedList>
      </section>

      <section className="grid gap-2" aria-label="Shared hole scores">
        <IOSSectionHeader
          title="Scorecard"
          description={`${round.holes.length} scored hole${round.holes.length === 1 ? "" : "s"}`}
        />
        <MobileSharedHoleRows holes={frontNine} />
        {remainingHoles.length > 0 ? (
          <IOSDisclosureGroup
            label="Remaining shared holes"
            items={[
              {
                value: "remaining-holes",
                title: "Back nine",
                summary: `${remainingHoles.length} holes`,
                description: "Hole-by-hole scoring detail",
                contentClassName: "px-0 pb-0 pt-0",
                content: <MobileSharedHoleRows holes={remainingHoles} />,
              },
            ]}
          />
        ) : null}
      </section>

      <IOSDisclosureGroup
        label="Shared round details"
        items={[
          {
            value: "round-details",
            title: "Round details",
            summary: round.session.teeName ?? "Tee not set",
            description: "Tee, conditions, equipment and link expiry",
            contentClassName: "px-0 pb-0 pt-0",
            content: (
              <IOSGroupedList label="Shared round detail rows" className="border-0">
                <IOSListRow label="Tee" value={round.session.teeName ?? "--"} />
                <IOSListRow
                  label="Rating / slope"
                  value={formatRatingSlope(round.session.courseRating, round.session.slopeRating)}
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
              </IOSGroupedList>
            ),
          },
        ]}
      />

      <IOSGroupedList label="Shared link privacy">
        <IOSListRow
          icon={Link2}
          label="Only this scorecard is shared"
          detail="Shot data and private account details are not exposed. The owner can revoke this link."
          status={<IOSInlineStatus label="Private read-only link" tone="positive" />}
        />
      </IOSGroupedList>
    </MobileAppShell>
  );
}

function MobileSharedHoleRows({ holes }: { holes: SharedScorecardHole[] }) {
  return (
    <IOSGroupedList label="Shared scorecard hole rows">
      {holes.length > 0 ? (
        holes.map((hole) => (
          <IOSListRow
            key={hole.holeNumber}
            label={`Hole ${hole.holeNumber}`}
            value={formatNullableInteger(hole.score)}
            detail={`Par ${integerFormatter.format(hole.par)} · ${
              hole.yards > 0 ? `${integerFormatter.format(hole.yards)} yd` : "yards not set"
            } · ${formatNullableInteger(hole.putts)} putts`}
            status={
              <IOSInlineStatus
                label={`FIR ${formatBoolean(hole.fairwayHit)} · GIR ${formatBoolean(hole.gir)} · ${formatNullableInteger(hole.penalties)} penalties`}
                tone="neutral"
              />
            }
          />
        ))
      ) : (
        <IOSListRow label="No scored holes" detail="The shared round has no scorecard rows." />
      )}
    </IOSGroupedList>
  );
}
