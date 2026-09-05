import Link from "next/link";
import type { SavedPracticePlan } from "@/lib/practice-planner";
import { formatClubType } from "@/lib/club-format";
import { MobileLargeTitle, MobileSection } from "@/components/app/mobile-screen";
import { MobileGroupedList, MobileListRow } from "@/components/app/mobile-primitives";
import { Button } from "@/components/ui/button";

/** Historical plans are read-only; reviewing one cannot restart or overwrite an active session. */
export function MobileSavedPracticeReview({ plan }: { plan: SavedPracticePlan }) {
  return (
    <div className="grid gap-6" data-saved-practice-review>
      <MobileLargeTitle
        title={plan.title}
        eyebrow="Practice review"
        detail={`${plan.timeMinutes} min${plan.totalBalls ? ` · ${plan.totalBalls} planned balls` : ""}`}
      />
      <MobileSection title={plan.result ? "Measured review" : "Activity completed"}>
        <p className="mobile-type-body">
          {plan.result?.verdict ??
            "You completed this practice activity. Import the measured shots to see how you performed."}
        </p>
        {plan.result?.nextAction ? (
          <p className="mobile-type-callout text-muted-foreground">{plan.result.nextAction}</p>
        ) : null}
        {!plan.result ? (
          <Button asChild>
            <Link href={`/import?practicePlanId=${plan.id}`}>Import measured session</Link>
          </Button>
        ) : null}
      </MobileSection>
      <MobileSection title="Planned blocks">
        <MobileGroupedList>
          {plan.blocks.map((block) => (
            <MobileListRow
              key={block.dbId}
              label={block.title}
              detail={`${block.clubs.map(formatClubType).join(", ")}${block.ballCount ? ` · ${block.ballCount} balls` : ""}`}
            />
          ))}
        </MobileGroupedList>
      </MobileSection>
      <Button asChild variant="outline">
        <Link href="/practice">Back to Practice</Link>
      </Button>
    </div>
  );
}
