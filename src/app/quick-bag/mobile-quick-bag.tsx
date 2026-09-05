"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { QuickBagClub } from "./quick-bag-client";
import { MobileSegmentedControl } from "@/components/app/mobile-controls";
import { MobileGroupedList } from "@/components/app/mobile-primitives";
import { mobileBagRows } from "@/lib/mobile-bag-rows";

export function MobileQuickBag({
  clubs,
  accountId,
  savedAt,
  legacy = false,
}: {
  clubs: QuickBagClub[];
  accountId?: string;
  savedAt?: string;
  legacy?: boolean;
}) {
  const [mode, setMode] = useState("carry");
  const [cacheState, setCacheState] = useState("Saving for offline use…");
  useEffect(() => {
    if (!accountId) return;
    try {
      localStorage.setItem(
        `fkh:quick-bag:${accountId}`,
        JSON.stringify({ version: 4, accountId, storedAt: new Date().toISOString(), clubs }),
      );
      queueMicrotask(() => setCacheState("Saved for offline use."));
    } catch {
      queueMicrotask(() => setCacheState("Storage unavailable. Keep this open."));
    }
  }, [accountId, clubs]);
  const sorted = mobileBagRows(clubs);
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
      {savedAt ? (
        <p className="mobile-type-footnote text-muted-foreground" role="status">
          Offline · saved {formatDate(savedAt, true)}. Reconnect to refresh.
          {legacy ? " Older snapshot. Reopen online to verify." : ""}
        </p>
      ) : null}
      <MobileGroupedList label="Club yardages">
        {sorted.map((club) => {
          const number = mode === "carry" ? club.trustedCarryYd : club.totalYd;
          return (
            <details key={club.id} className="mobile-quick-bag-club group">
              <summary className="mobile-yardage-row">
                <span>
                  <strong>{club.label}</strong>
                  {club.equipmentLabel ? <small>{club.equipmentLabel}</small> : null}
                  {mode === "carry" && club.lowYd != null && club.highYd != null ? (
                    <small>
                      {Math.round(club.lowYd)}–{Math.round(club.highYd)} yd
                      {club.evidenceKind === "touch" ? " · touch" : ""}
                    </small>
                  ) : (
                    <small>
                      {number == null
                        ? "Not measured"
                        : `${mode === "total" ? (club.totalSampleSize ?? club.sampleSize) : club.sampleSize} trusted shots`}
                    </small>
                  )}
                </span>
                <span className="mobile-yardage-number">
                  {number != null ? Math.round(number) : "—"}
                  <small>yd</small>
                </span>
                <ChevronDown
                  className="size-4 text-muted-foreground group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="mobile-quick-bag-evidence">
                <p className="mobile-type-callout">{club.model}</p>
                <dl className="mobile-type-footnote grid gap-2">
                  <Evidence
                    label="Sample"
                    value={`${club.sampleSize} trusted ${club.evidenceKind === "touch" ? "touch" : club.evidenceKind === "full" ? "full-swing" : "measured"} shots`}
                  />
                  <Evidence label="Last measured" value={formatDate(club.latestEvidenceDate)} />
                  <Evidence
                    label="Confidence"
                    value={
                      club.evidenceKind === "touch"
                        ? "Touch depends on intent"
                        : club.sampleSize === 0
                          ? "Not established"
                          : `${club.confidence}% stock score`
                    }
                  />
                </dl>
                {accountId ? (
                  <Link
                    className="mobile-type-callout flex min-h-11 items-center text-primary"
                    href={`/bag/${club.id}`}
                  >
                    Club detail
                  </Link>
                ) : null}
              </div>
            </details>
          );
        })}
      </MobileGroupedList>
      {!clubs.length ? (
        <p className="text-muted-foreground">Import shots to establish distances.</p>
      ) : (
        <p className="mobile-type-footnote text-muted-foreground" role="status">
          {savedAt ? "" : cacheState + " "}
          {mode === "total"
            ? "Total varies with ground conditions."
            : "Range: middle half of trusted carries."}
        </p>
      )}
    </div>
  );
}
function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
function formatDate(value: string | null | undefined, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(value));
}
