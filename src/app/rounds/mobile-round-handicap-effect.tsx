import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentHandicapRounds } from "@/lib/handicap-data";
import { calculateRoundHandicapEffect } from "@/lib/round-handicap-effect";
import { formatHandicapValue } from "@/lib/round-handicap";

export async function MobileRoundHandicapEffect({ sessionId }: { sessionId: string }) {
  const rounds = await getCurrentHandicapRounds();
  const effect = calculateRoundHandicapEffect(rounds, sessionId);
  const selected = rounds.find((round) => round.id === sessionId);
  return (
    <section className="mt-4 border-y py-4" aria-label="Handicap effect">
      <Link href="/handicap" className="flex min-h-11 items-center justify-between gap-3">
        <div>
          <h3 className="mobile-type-headline">{effect?.scope ?? "Handicap"} estimate</h3>
          {effect ? (
            <p className="mobile-type-title2 mt-1 tabular-nums">
              {effect.previous !== null ? (
                <>
                  <span className="text-muted-foreground">
                    {formatHandicapValue(effect.previous)}
                  </span>
                  <span className="px-2" aria-label="to">
                    →
                  </span>
                </>
              ) : null}
              {formatHandicapValue(effect.current)}
            </p>
          ) : (
            <p className="mobile-type-callout text-muted-foreground">Effect unavailable</p>
          )}
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      {effect ? (
        <>
          <p
            className={`mobile-type-callout mt-1 ${effect.direction === "down" ? "text-primary" : "text-muted-foreground"}`}
          >
            {effect.delta === null
              ? "First estimate established"
              : effect.direction === "flat"
                ? "No change from this round"
                : `${effect.delta < 0 ? "Down" : "Up"} ${formatHandicapValue(Math.abs(effect.delta))} after this round`}
          </p>
          <details className="mt-1">
            <summary className="mobile-type-footnote flex min-h-11 cursor-pointer items-center text-primary">
              How this is calculated
            </summary>
            <p className="mobile-type-footnote text-muted-foreground">
              {effect.methodLabel}. App estimate at this round, using saved{" "}
              {effect.scope === "Course" ? "course" : "simulator"} scores.
              {selected?.isNineHoleEquivalent
                ? " This 9-hole round uses an 18-hole equivalent."
                : ""}
            </p>
          </details>
        </>
      ) : (
        <p className="mobile-type-footnote mt-1 text-muted-foreground">
          A complete 9- or 18-hole scorecard is needed to calculate the effect.
        </p>
      )}
    </section>
  );
}
