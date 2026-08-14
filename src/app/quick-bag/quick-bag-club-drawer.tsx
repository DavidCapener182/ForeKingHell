"use client";

import type { QuickBagClub } from "@/app/quick-bag/quick-bag-client";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const evidenceDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

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
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            Club evidence
          </p>
          <DrawerTitle className="font-heading text-2xl font-bold">
            {club?.label ?? "Club detail"}
          </DrawerTitle>
          <DrawerDescription>
            {club ? `${club.model} · your measured stock numbers` : "Choose a measured club."}
          </DrawerDescription>
        </DrawerHeader>
        {club ? (
          <div className="grid gap-4 overflow-y-auto px-4 pb-4">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border ring-1 ring-border">
              <PrimaryMetric label="Trusted carry" value={yardValue(club.trustedCarryYd)} />
              <PrimaryMetric label="Play number" value={yardValue(club.playNumberYd)} />
            </div>

            <LateralDispersionGraphic club={club} />

            <dl className="grid gap-0 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
              <EvidenceRow label="Measured range" value={rangeLabel(club)} />
              <EvidenceRow label="Common miss" value={missLabel(club)} divided />
              <EvidenceRow
                label="Sample"
                value={
                  club.sampleSize === 0 ? "No trusted shots" : `${club.sampleSize} trusted shots`
                }
                divided
              />
              <EvidenceRow
                label="Confidence"
                value={club.sampleSize === 0 ? "Not established" : `${club.confidence}%`}
                divided
              />
              <EvidenceRow
                label="Latest evidence"
                value={formatEvidenceDate(club.latestEvidenceDate)}
                divided
              />
            </dl>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function PrimaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#052f22] p-4 text-white">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/65">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function EvidenceRow({
  label,
  value,
  divided = false,
}: {
  label: string;
  value: string;
  divided?: boolean;
}) {
  return (
    <div
      className={`flex min-h-12 items-center justify-between gap-4 px-3 ${divided ? "border-t" : ""}`}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-semibold">{value}</dd>
    </div>
  );
}

function LateralDispersionGraphic({ club }: { club: QuickBagClub }) {
  const low = club.lateralLowYd;
  const high = club.lateralHighYd;
  const median = club.medianLateralYd;
  const bound = Math.max(10, Math.abs(low ?? 0), Math.abs(high ?? 0));
  const position = (value: number) => 50 + (value / bound) * 42;
  const hasRange = low !== null && high !== null;

  return (
    <figure
      className="rounded-2xl bg-muted/55 p-4"
      role="img"
      aria-label={`${club.label} lateral dispersion. ${missLabel(club)}.`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="font-semibold">Lateral dispersion</figcaption>
        <span className="text-xs text-muted-foreground">
          {club.patternSampleSize} pattern shots
        </span>
      </div>
      <div className="relative mt-3 h-16 overflow-hidden rounded-xl border border-primary/15 bg-card">
        <div className="absolute inset-y-0 left-1/2 w-px bg-primary/30" />
        <div className="absolute left-[7%] right-[7%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary/10" />
        {hasRange ? (
          <div
            className="absolute top-1/2 h-5 -translate-y-1/2 rounded-full border border-primary/25 bg-primary/20"
            style={{
              left: `${position(Math.min(low, high))}%`,
              width: `${Math.max(3, position(Math.max(low, high)) - position(Math.min(low, high)))}%`,
            }}
          />
        ) : null}
        {median !== null ? (
          <div
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm"
            style={{ left: `${position(median)}%` }}
          />
        ) : null}
        <span className="absolute bottom-1.5 left-2 text-[0.65rem] font-medium text-muted-foreground">
          Left
        </span>
        <span className="absolute bottom-1.5 right-2 text-[0.65rem] font-medium text-muted-foreground">
          Right
        </span>
      </div>
      <p className="mt-2 text-sm font-medium">{missLabel(club)}</p>
    </figure>
  );
}

function yardValue(value: number | null) {
  return value === null ? "—" : `${Math.round(value)} yd`;
}

function rangeLabel(club: QuickBagClub) {
  return club.lowYd === null || club.highYd === null
    ? "Not measured"
    : `${Math.round(Math.min(club.lowYd, club.highYd))}–${Math.round(Math.max(club.lowYd, club.highYd))} yd`;
}

function missLabel(club: QuickBagClub) {
  if (club.typicalMiss) return club.typicalMiss;
  if (club.widerSide) return `Wider ${club.widerSide}`;
  return "Not established";
}

function formatEvidenceDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : evidenceDateFormatter.format(date);
}
