"use client";

import { type ReactNode, useState } from "react";

import ClubDeliveryChart, {
  formatSignedDegrees,
} from "@/components/visuals/face-path-delivery-chart";
import { deliverySummary, deliveryTendency, targetSide } from "@/lib/club-delivery";
import { DeliveryAssessment } from "./delivery-assessment";
import type { Handedness } from "@/lib/units";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UntitledSelect, UntitledTextField } from "@/components/untitled-ui/form-controls";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import type { PathTrendTracking } from "@/lib/bag-intelligence";
import { cn } from "@/lib/utils";

export function FacePathClubSelector({
  pathTrend,
  action,
  className,
  compact = false,
}: {
  pathTrend: PathTrendTracking;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const clubs = [...pathTrend.clubs].sort(
    (a, b) =>
      Number(b.clubId === pathTrend.clubId) - Number(a.clubId === pathTrend.clubId) ||
      b.delivery.length - a.delivery.length,
  );
  const [hand, setHand] = useState<Handedness>("right");
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.clubId ?? "");
  const selected = clubs.find((club) => club.clubId === selectedClubId) ?? clubs[0] ?? null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  if (!selected) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-muted/35 px-4 py-4 text-sm text-muted-foreground",
          className,
        )}
      >
        Import club-path rows to build face-to-path reads.
      </div>
    );
  }

  const stats = deliverySummary(selected.delivery);
  const tendency = deliveryTendency(stats.face, stats.delta, hand);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card px-3 shadow-sm",
        compact ? "py-2.5" : "py-3",
        className,
      )}
    >
      <div
        className={cn(
          "grid items-start xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]",
          compact ? "gap-2" : "gap-3",
        )}
      >
        <div className="grid content-start gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-normal text-primary">
                Club delivery
              </p>
              <Badge variant="secondary">
                {selected.clubId === pathTrend.clubId ? "Priority read" : "Club read"}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p
                className={cn(
                  "font-bold tracking-normal text-foreground",
                  compact ? "text-[20px] leading-6" : "text-[22px] leading-7",
                )}
              >
                {tendency.label}
              </p>
              <p className="text-sm leading-5 text-muted-foreground">
                {selected.label} · {selected.delivery.length} shots · {selected.cohortLabel}
              </p>
            </div>
          </div>

          <div className="grid items-end gap-2 sm:grid-cols-2">
            <div className="hidden lg:block">
              <UntitledSelect
                label="Selected club"
                name="deliveryClub"
                value={selected.clubId}
                onValueChange={setSelectedClubId}
                options={clubs.map((club) => ({
                  value: club.clubId,
                  label: `${club.label} · ${club.delivery.length} shots`,
                }))}
              />
            </div>
            <div className="lg:hidden">
              <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="min-h-11 w-full justify-between">
                    {selected.label}
                    <span>Change club</span>
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  className="max-h-[85dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
                  showCloseButton={false}
                >
                  <SheetHeader>
                    <SheetTitle>Choose a club</SheetTitle>
                    <SheetDescription>
                      Update the chart, measurements and diagnosis together.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-2 px-4">
                    <UntitledTextField
                      label="Search clubs"
                      name="deliverySearch"
                      type="search"
                      value={search}
                      onValueChange={setSearch}
                    />
                    {clubs
                      .filter((club) => club.label.toLowerCase().includes(search.toLowerCase()))
                      .map((club) => (
                        <Button
                          key={club.clubId}
                          variant={club.clubId === selected.clubId ? "default" : "outline"}
                          aria-pressed={club.clubId === selected.clubId}
                          className="h-auto min-h-11 justify-between whitespace-normal text-left"
                          onClick={() => {
                            setSelectedClubId(club.clubId);
                            setPickerOpen(false);
                          }}
                        >
                          <span>{club.label}</span>
                          <span>{club.delivery.length} shots</span>
                        </Button>
                      ))}
                    {!clubs.some((club) =>
                      club.label.toLowerCase().includes(search.toLowerCase()),
                    ) ? (
                      <p role="status" className="py-4 text-sm">
                        No matching clubs. Clear the search to see every club.
                      </p>
                    ) : null}
                    <SheetClose asChild>
                      <Button variant="outline" className="min-h-11">
                        Close
                      </Button>
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <UntitledSelect
              label="Playing hand"
              name="deliveryHand"
              value={hand}
              onValueChange={(value) => setHand(value === "left" ? "left" : "right")}
              options={[
                { value: "right", label: "Right-handed" },
                { value: "left", label: "Left-handed" },
              ]}
            />
          </div>
          <DeliveryAngles stats={stats} reference={tendency.reference} />
          {action ? <div className="pt-1 2xl:mt-auto">{action}</div> : null}
        </div>

        <div key={selected.clubId} className="grid min-w-0 gap-3">
          <ClubDeliveryChart
            clubName={selected.label}
            clubPath={stats.path}
            faceAngle={stats.face}
            rows={selected.delivery}
          />
        </div>
      </div>
      <DeliveryAssessment key={selected.clubId} club={selected} stats={stats} hand={hand} />
    </div>
  );
}

function DeliveryAngles({
  stats,
  reference,
}: {
  stats: ReturnType<typeof deliverySummary>;
  reference: string;
}) {
  const readings = [
    { label: "Club path", value: stats.path, reference: targetSide(stats.path) },
    { label: "Face angle", value: stats.face, reference: targetSide(stats.face) },
    { label: "Face-to-path", value: stats.delta, reference },
  ];
  const extent = Math.max(5, ...readings.map(({ value }) => Math.ceil(Math.abs(value ?? 0))));
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="p-4">
        <dl className="divide-y">
          {readings.map(({ label, value, reference }) => (
            <div
              key={label}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(4rem,1fr)_4rem] items-center gap-3 py-3"
            >
              <dt className="min-w-0">
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{reference}</span>
              </dt>
              <dd className="relative h-2 rounded-sm bg-muted" aria-hidden="true">
                <span className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/60" />
                {value !== null && (
                  <span
                    className="absolute inset-y-0 rounded-sm bg-primary"
                    style={{
                      left: `${50 + (Math.min(0, value) / extent) * 50}%`,
                      width: `${(Math.abs(value) / extent) * 50}%`,
                    }}
                  />
                )}
              </dd>
              <dd className="text-right text-lg font-semibold tabular-nums">
                {value === null ? "—" : formatSignedDegrees(value).replace(" deg", "°")}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Centre line is 0°. Each scale runs from −{extent}° to +{extent}°. Averages use{" "}
          {stats.deltas.length
            ? stats.deltas.length + " paired face and path readings"
            : "available path readings"}
          .
        </p>
      </CardContent>
    </Card>
  );
}
