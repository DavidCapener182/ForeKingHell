"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";

export function QuickBagClubDrawer({
  club,
  open,
  onOpenChange,
}: {
  club: QuickBagClub | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{club?.label ?? "Club detail"}</DrawerTitle>
          <DrawerDescription>
            {club ? `${club.model} · ${confidenceLabel(club)}` : "Choose a measured club."}
          </DrawerDescription>
        </DrawerHeader>
        {club ? (
          <div className="grid gap-4 px-4 pb-4">
            <LateralRange club={club} />
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/55 p-3">
              <QuickMetric label="Trusted carry" value={yardValue(club.trustedCarryYd)} />
              <QuickMetric label="Play number" value={yardValue(club.playNumberYd)} />
              <QuickMetric label="Measured range" value={rangeLabel(club)} />
              <QuickMetric label="Typical pattern" value={patternLabel(club)} />
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function QuickMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function LateralRange({ club }: { club: QuickBagClub }) {
  const low = club.lateralLowYd;
  const high = club.lateralHighYd;
  const median = club.medianLateralYd;
  const bound = Math.max(10, Math.abs(low ?? 0), Math.abs(high ?? 0));
  const position = (value: number) => 50 + (value / bound) * 44;
  return (
    <div
      className="rounded-xl border bg-card p-4"
      role="img"
      aria-label={`${club.label} lateral measured range. ${patternLabel(club)}.`}
    >
      <div className="relative h-14">
        <div className="absolute left-[6%] right-[6%] top-6 h-1 rounded-full bg-secondary" />
        <div className="absolute left-1/2 top-2 h-9 w-px bg-foreground/40" />
        {low !== null && high !== null ? (
          <div
            className="absolute top-5 h-3 rounded-full bg-primary/30"
            style={{
              left: `${position(low)}%`,
              width: `${Math.max(2, position(high) - position(low))}%`,
            }}
          />
        ) : null}
        {median !== null ? (
          <div
            className="absolute top-4 size-5 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow"
            style={{ left: `${position(median)}%` }}
          />
        ) : null}
        <span className="absolute bottom-0 left-0 text-xs text-muted-foreground">Left</span>
        <span className="absolute bottom-0 right-0 text-xs text-muted-foreground">Right</span>
      </div>
      <p className="mt-2 text-sm font-medium">
        {patternLabel(club)} · {club.patternSampleSize} trusted shots
      </p>
    </div>
  );
}

function yardValue(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}

function rangeLabel(club: QuickBagClub) {
  return club.lowYd === null || club.highYd === null
    ? "Range not measured"
    : `${Math.round(Math.min(club.lowYd, club.highYd))}–${Math.round(Math.max(club.lowYd, club.highYd))} yd`;
}

function patternLabel(club: QuickBagClub) {
  if (club.typicalMiss) return `Typical miss: ${club.typicalMiss}`;
  if (club.widerSide) return `Wider side: ${club.widerSide}`;
  return "Direction not established";
}

function confidenceLabel(club: QuickBagClub) {
  return club.sampleSize === 0 ? "No measured sample" : `${club.confidence}% confidence`;
}
