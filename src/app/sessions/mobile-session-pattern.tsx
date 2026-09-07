"use client";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { useClientReady } from "@/hooks/use-client-ready";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShotMasterDetailRow } from "@/app/shots/shots-master-detail-table";
import type { ShotPatternPoint } from "@/lib/shot-pattern-chart-data";
import { LazyMobileShotPatternCharts } from "@/components/app/lazy-mobile-shot-pattern-charts";
export function MobileSessionPattern({
  points,
  preferredClub,
  initiallyOpen = false,
  details = [],
  correctionClubs = [],
}: {
  points: ShotPatternPoint[];
  preferredClub: string | null;
  initiallyOpen?: boolean;
  details?: ShotMasterDetailRow[];
  correctionClubs?: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const ready = useClientReady();
  const id = useId();
  const query = useSearchParams();
  const requested = query.get("club");
  const club = points.some((point) => point.clubType === requested) ? requested : preferredClub;
  return (
    <div className="grid gap-3">
      <Button
        variant="outline"
        className="min-h-12 justify-between"
        aria-expanded={open}
        disabled={!ready}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide shot pattern" : "Show shot pattern"}
        <ChevronDown className={open ? "rotate-180" : undefined} aria-hidden />
      </Button>
      <div id={id} hidden={!open}>
        {open ? (
          <LazyMobileShotPatternCharts
            key={club}
            points={points}
            preferredClub={club}
            details={details}
            correctionClubs={correctionClubs}
          />
        ) : null}
      </div>
    </div>
  );
}
