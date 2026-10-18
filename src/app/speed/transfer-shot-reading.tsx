import { formatSpeed } from "@/lib/speed-training";

/** Missing lateral evidence cannot be labelled as a missed corridor. */
export function TransferShotReading({
  shot,
  position,
  corridor,
}: {
  shot: { shotNumber: number | null; clubSpeedMph: number | null; sideCarryYd: number | null };
  position: number;
  corridor: { minSideCarryYd: number; maxSideCarryYd: number };
}) {
  const measured = shot.sideCarryYd !== null && Number.isFinite(shot.sideCarryYd);
  const inside =
    measured &&
    shot.sideCarryYd! >= corridor.minSideCarryYd &&
    shot.sideCarryYd! <= corridor.maxSideCarryYd;
  const lateral = measured
    ? `${shot.sideCarryYd! > 0 ? "+" : ""}${shot.sideCarryYd!.toFixed(1)} yd`
    : "Lateral reading unavailable";
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
      <span className="font-medium text-foreground">
        Shot {shot.shotNumber ?? position} · {formatSpeed(shot.clubSpeedMph)}
      </span>
      <span className={inside ? "text-primary" : "text-muted-foreground"}>
        {lateral} · {measured ? (inside ? "Inside" : "Outside") : "Inconclusive"}
      </span>
    </li>
  );
}
