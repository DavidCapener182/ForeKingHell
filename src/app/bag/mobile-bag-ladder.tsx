import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { MobileGroupedList, MobileListRow, MobileStatus } from "@/components/app/mobile-primitives";
import { mobileBagRows } from "@/lib/mobile-bag-rows";

export function MobileBagLadder({ clubs }: { clubs: QuickBagClub[] }) {
  const rows = mobileBagRows(clubs);
  const longest = Math.max(1, ...rows.map((club) => club.trustedCarryYd ?? 0));
  return (
    <MobileGroupedList label="Club distance ladder">
      {rows.map((club) => {
        const high = club.confidence >= 75 && club.sampleSize >= 10;
        const touch = club.evidenceKind === "touch";
        return (
          <MobileListRow
            key={club.id}
            href={`/bag/${club.id}`}
            label={club.label}
            value={
              <span className="text-xl font-semibold text-foreground tabular-nums">
                {club.trustedCarryYd == null ? "—" : `${Math.round(club.trustedCarryYd)} yd`}
              </span>
            }
            detail={
              <span className="grid gap-1">
                {club.equipmentLabel ? <span>{club.equipmentLabel}</span> : null}
                <span>
                  {club.lowYd != null && club.highYd != null
                    ? `${Math.round(club.lowYd)}–${Math.round(club.highYd)} yd · `
                    : ""}
                  {club.sampleSize} trusted {touch ? "touch " : ""}shots
                </span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className={`block h-full rounded-full ${high && !touch ? "bg-primary" : "bg-muted-foreground/50"}`}
                    style={{
                      width: `${Math.max(0, Math.min(100, ((club.trustedCarryYd ?? 0) / longest) * 100))}%`,
                    }}
                  />
                </span>
              </span>
            }
            status={
              <MobileStatus
                tone={high && !touch ? "positive" : "attention"}
                label={
                  touch
                    ? "Touch · varies by intent"
                    : club.sampleSize === 0
                      ? "Not measured"
                      : `${high ? "High" : club.confidence >= 50 ? "Moderate" : "Building"} confidence`
                }
              />
            }
          />
        );
      })}
    </MobileGroupedList>
  );
}
