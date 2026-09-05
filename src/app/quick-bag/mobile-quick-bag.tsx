"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight } from "lucide-react";
import type { QuickBagClub } from "./quick-bag-client";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { MobileGroupedList } from "@/components/app/mobile-primitives";
const Detail = dynamic(() => import("./quick-bag-club-drawer").then((m) => m.QuickBagClubDrawer));

export function MobileQuickBag({ clubs, accountId }: { clubs: QuickBagClub[]; accountId: string }) {
  const [mode, setMode] = useState("carry");
  const [selected, setSelected] = useState<QuickBagClub | null>(null);
  const [cached, setCached] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(
        `fkh:quick-bag:${accountId}`,
        JSON.stringify({ version: 3, storedAt: new Date().toISOString(), clubs }),
      );
      queueMicrotask(() => setCached(true));
    } catch {
      queueMicrotask(() => setCached(false));
    }
  }, [accountId, clubs]);
  const sorted = [...clubs].sort((a, b) => (b.trustedCarryYd ?? 0) - (a.trustedCarryYd ?? 0));
  return (
    <div className="grid gap-5" data-quick-bag-hydrated="true">
      <MobileSegmentedControl
        ariaLabel="Yardage type"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "carry", label: "Carry" },
          { value: "total", label: "Total" },
        ]}
      />
      <MobileGroupedList label="Club yardages">
        {sorted.map((club) => {
          const number = mode === "carry" ? club.trustedCarryYd : club.totalYd;
          return (
            <button key={club.id} onClick={() => setSelected(club)} className="mobile-yardage-row">
              <span>
                <strong>{club.label}</strong>
                {mode === "carry" && club.lowYd != null && club.highYd != null ? (
                  <small>
                    {Math.round(club.lowYd)}–{Math.round(club.highYd)} yd
                  </small>
                ) : (
                  <small>
                    {club.sampleSize
                      ? `${club.sampleSize} trusted shots`
                      : "Needs measured evidence"}
                  </small>
                )}
              </span>
              <span className="mobile-yardage-number">
                {number != null ? Math.round(number) : "—"}
                <small>yd</small>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </button>
          );
        })}
      </MobileGroupedList>
      {!clubs.length ? (
        <p className="text-muted-foreground">
          Import a measured session to build your club distances.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {cached ? "Yardages saved on this iPhone." : "Offline storage unavailable."}{" "}
          {mode === "total"
            ? "Measured finish distance varies with ground conditions."
            : "Ranges show the middle half of trusted carries."}
        </p>
      )}
      {selected ? (
        <Detail
          club={selected}
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}
