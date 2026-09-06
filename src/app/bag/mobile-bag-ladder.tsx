import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import { mobileBagRows } from "@/lib/mobile-bag-rows";

export function MobileBagLadder({ clubs }: { clubs: QuickBagClub[] }) {
  const rows = mobileBagRows(clubs);
  return (
    <div className="overflow-hidden rounded-2xl bg-card" aria-label="Club distance ladder">
      <div className="flex justify-between border-b border-border px-4 py-3 text-xs font-medium text-muted-foreground">
        <span>Club · typical range</span>
        <span>Carry · confidence</span>
      </div>
      {rows.map((club) => {
        const high = club.confidence >= 75 && club.sampleSize >= 10;
        const touch = club.evidenceKind === "touch";
        const confidence = touch
          ? "Touch shots"
          : !club.sampleSize
            ? "Not measured"
            : high
              ? "High confidence"
              : club.confidence >= 50
                ? "Moderate confidence"
                : "Building confidence";
        return (
          <Link
            key={club.id}
            href={`/bag/${club.id}`}
            className="flex min-h-20 items-center gap-3 border-b border-border px-4 py-3 last:border-0 active:bg-secondary"
          >
            <span className="min-w-0 flex-1">
              <strong className="block text-base font-semibold">{club.label}</strong>
              <span className="block text-xs text-muted-foreground">
                {club.lowYd != null && club.highYd != null
                  ? `${Math.round(club.lowYd)}–${Math.round(club.highYd)} yd · `
                  : ""}
                {club.sampleSize} trusted shots
              </span>
              {club.equipmentLabel ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {club.equipmentLabel}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-right">
              <strong
                aria-label={
                  club.trustedCarryYd == null
                    ? "Carry not measured"
                    : `${Math.round(club.trustedCarryYd)} yd`
                }
                className="block text-2xl font-semibold tracking-tight tabular-nums"
              >
                {club.trustedCarryYd == null ? "—" : Math.round(club.trustedCarryYd)}{" "}
                <span className="text-xs font-normal text-muted-foreground">yd</span>
              </strong>
              <span
                className={`block text-[11px] ${high && !touch ? "text-primary" : "text-muted-foreground"}`}
              >
                {confidence}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}
