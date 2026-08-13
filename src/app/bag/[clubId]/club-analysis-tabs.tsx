"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Gauge,
  Target,
  type LucideIcon,
} from "lucide-react";

import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import { IOSDisclosureGroup } from "@/components/app/ios-mobile";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { DataTableFrame } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { resolveClubFaceAngleDeg } from "@/lib/club-face-angle";
import { clubAccent } from "@/lib/club-format";
import { selectStockYardageShots } from "@/lib/stock-yardage";
import { cn } from "@/lib/utils";

export type AnalysisShot = {
  id: string;
  shotNumber: number | null;
  shotAt: string;
  carryYd: number | null;
  totalYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  launchAngleDeg: number | null;
  launchDirectionDeg: number | null;
  apexFt: number | null;
  attackAngleDeg: number | null;
  clubPathDeg: number | null;
  faceAngleDeg: number | null;
  descentAngleDeg: number | null;
  smashFactor: number | null;
  spinRate: number | null;
  spinAxis: number | null;
  shotCategory: string | null;
  qualityTag: string | null;
  courseHoleNumber: number | null;
  sessionType: string | null;
  clubDataEstType: string | null;
};

type DistanceView = "carry" | "total";

const numberFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
});

const clubShotEvidenceColumns: DesktopWorkbenchColumn[] = [
  { id: "shot", label: "Shot", locked: true },
  { id: "date", label: "Date" },
  { id: "carry", label: "Carry" },
  { id: "total", label: "Total" },
  { id: "offline", label: "Offline" },
  { id: "ball-speed", label: "Ball speed" },
  { id: "club-speed", label: "Club speed" },
  { id: "launch", label: "Launch" },
  { id: "path", label: "Path" },
  { id: "face", label: "Face" },
  { id: "quality", label: "Quality" },
  { id: "action", label: "Action", locked: true },
];

const clubShotEvidenceSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Selected range",
    href: "#club-shot-evidence-table",
    detail: "Every shot currently feeding the club profile metrics.",
  },
  {
    title: "Dispersion",
    href: "#club-dispersion",
    detail: "Use the same shots on the dispersion map.",
  },
  {
    title: "All shots",
    href: "/shots",
    detail: "Open the global shot explorer for deeper filtering.",
  },
];

export function ClubAnalysisTabs({
  clubType,
  clubModelName,
  clubTypeLabel,
  shots,
  afterDispersion,
  mobileSupport,
}: {
  clubType: string;
  clubModelName: string;
  clubTypeLabel: string;
  shots: AnalysisShot[];
  afterDispersion?: ReactNode;
  mobileSupport?: ReactNode;
}) {
  const accent = clubAccent(clubType);
  const [distanceView, setDistanceView] = useState<DistanceView>("carry");
  const [selectedShotId, setSelectedShotId] = useState(shots[0]?.id ?? "");
  const [openDateKeys, setOpenDateKeys] = useState<string[] | null>(null);
  const visibleSelectedShotId = shots.some((shot) => shot.id === selectedShotId)
    ? selectedShotId
    : (shots[0]?.id ?? "");
  const selectedShot = shots.find((shot) => shot.id === visibleSelectedShotId) ?? null;
  const sortedShots = useMemo(
    () =>
      [...shots].sort(
        (left, right) => Number(left.shotNumber ?? 0) - Number(right.shotNumber ?? 0),
      ),
    [shots],
  );
  const shotDateGroups = useMemo(() => groupShotsByDate(shots), [shots]);
  const activeOpenDateKeys = useMemo(() => {
    const validDateKeys = new Set(shotDateGroups.map((group) => group.dateKey));
    const currentDateKeys = openDateKeys ?? (shotDateGroups[0] ? [shotDateGroups[0].dateKey] : []);

    return currentDateKeys.filter((dateKey) => validDateKeys.has(dateKey));
  }, [openDateKeys, shotDateGroups]);
  const toggleDateGroup = (dateKey: string, open: boolean) => {
    setOpenDateKeys((current) => {
      const baseDateKeys = current ?? (shotDateGroups[0] ? [shotDateGroups[0].dateKey] : []);

      if (open) {
        return baseDateKeys.includes(dateKey) ? baseDateKeys : [...baseDateKeys, dateKey];
      }

      return baseDateKeys.filter((currentDateKey) => currentDateKey !== dateKey);
    });
  };
  const selectShot = (shotId: string) => {
    const nextShot = shots.find((shot) => shot.id === shotId);

    setSelectedShotId(shotId);

    if (!nextShot) {
      return;
    }

    const dateKey = shotDateKey(nextShot.shotAt);

    setOpenDateKeys((current) => {
      const baseDateKeys = current ?? (shotDateGroups[0] ? [shotDateGroups[0].dateKey] : []);

      return baseDateKeys.includes(dateKey) ? baseDateKeys : [...baseDateKeys, dateKey];
    });
  };

  return (
    <div className="space-y-5">
      <section
        id="club-dispersion"
        className="premium-card scroll-mt-28 overflow-hidden p-3 sm:p-4"
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="grid size-11 shrink-0 place-items-center rounded-full text-white"
              style={{ background: accent }}
            >
              <Target className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-normal">Dispersion Map</h2>
              <p className="truncate text-sm text-muted-foreground">
                {clubModelName} · {clubTypeLabel} · this is how the club behaves.
              </p>
            </div>
          </div>
          <div className="apple-panel flex w-fit p-1">
            <Button
              type="button"
              size="sm"
              variant={distanceView === "carry" ? "default" : "ghost"}
              onClick={() => setDistanceView("carry")}
              className={cn("min-h-11", distanceView === "carry" ? "bg-[#0B7A3B] text-white" : "")}
            >
              Carry
            </Button>
            <Button
              type="button"
              size="sm"
              variant={distanceView === "total" ? "default" : "ghost"}
              onClick={() => setDistanceView("total")}
              className={cn("min-h-11", distanceView === "total" ? "bg-[#0B7A3B] text-white" : "")}
            >
              Total
            </Button>
          </div>
        </div>
        <DispersionPanel
          clubType={clubType}
          shots={sortedShots}
          selectedShotId={selectedShot?.id ?? ""}
          onSelect={selectShot}
          distanceView={distanceView}
          accent={accent}
        />
      </section>

      <div className="lg:hidden">
        <IOSDisclosureGroup
          label="Club analysis detail"
          items={[
            ...(mobileSupport
              ? [
                  {
                    value: "club-intelligence",
                    title: "Club intelligence",
                    summary: `${shots.length} shots`,
                    description: "Health, gapping, development and supporting context",
                    content: mobileSupport,
                  },
                ]
              : []),
            {
              value: "trajectory",
              title: "Trajectory",
              summary: selectedShot ? `Shot #${selectedShot.shotNumber ?? "-"}` : "No shot",
              description: "Flight window and apex pattern",
              content: (
                <TrajectoryPanel
                  shots={sortedShots}
                  selectedShotId={selectedShot?.id ?? ""}
                  accent={accent}
                />
              ),
              contentClassName: "px-2",
            },
            {
              value: "selected-shot",
              title: "Selected shot metrics",
              summary: formatMetric(selectedShot?.carryYd ?? null, " yd"),
              description: "Delivery, strike, launch and spin",
              content: <MobileSelectedShotMetrics shot={selectedShot} />,
            },
            {
              value: "shot-evidence",
              title: "Measured shot evidence",
              summary: `${sortedShots.length} rows`,
              description: "A mobile list of every shot in this evidence window",
              content: (
                <MobileShotEvidenceRows
                  shots={sortedShots}
                  selectedShotId={selectedShot?.id ?? ""}
                  onSelect={selectShot}
                />
              ),
              contentClassName: "px-0",
            },
          ]}
        />
      </div>

      <div className="hidden space-y-5 lg:block">
        {afterDispersion ? <div className="space-y-5">{afterDispersion}</div> : null}

        <ShotEvidenceWorkbench
          shots={sortedShots}
          selectedShotId={selectedShot?.id ?? ""}
          clubModelName={clubModelName}
          clubTypeLabel={clubTypeLabel}
          onSelect={selectShot}
        />

        <section className="premium-card p-4">
          <SectionTitle
            icon={Activity}
            title="Trajectory"
            detail="Flight window and apex pattern for the selected club."
            accent={accent}
          />
          <TrajectoryPanel
            shots={sortedShots}
            selectedShotId={selectedShot?.id ?? ""}
            accent={accent}
          />
        </section>

        <section className="premium-card p-4">
          <SectionTitle
            icon={Gauge}
            title="Club Metrics"
            detail={`Selected shot #${selectedShot?.shotNumber ?? "-"} delivery and impact numbers.`}
            accent={accent}
          />
          <ClubDataPanel clubType={clubType} selectedShot={selectedShot} accent={accent} />
          <ShotMetricStrip shot={selectedShot} accent={accent} />
        </section>

        <ShotHistory
          groups={shotDateGroups}
          activeOpenDateKeys={activeOpenDateKeys}
          selectedShotId={selectedShot?.id ?? ""}
          clubModelName={clubModelName}
          clubTypeLabel={clubTypeLabel}
          accent={accent}
          onToggleGroup={toggleDateGroup}
          onSelect={selectShot}
        />
      </div>
    </div>
  );
}

function MobileSelectedShotMetrics({ shot }: { shot: AnalysisShot | null }) {
  if (!shot) {
    return <p className="text-sm text-muted-foreground">No measured shot is selected.</p>;
  }

  const metrics = [
    ["Carry", formatMetric(shot.carryYd, " yd")],
    ["Total", formatMetric(shot.totalYd, " yd")],
    ["Offline", formatSide(shot.sideCarryYd)],
    ["Ball speed", formatMetric(shot.ballSpeedMph, " mph")],
    ["Club speed", formatMetric(shot.clubSpeedMph, " mph")],
    ["Launch", formatMetric(shot.launchAngleDeg, " deg")],
    ["Apex", formatMetric(shot.apexFt, " ft")],
    ["Path", formatMetric(shot.clubPathDeg, " deg")],
    ["Face", formatMetric(resolveClubFaceAngleDeg(shot), " deg")],
    ["Smash", formatMetric(shot.smashFactor)],
    ["Spin", formatMetric(shot.spinRate, " rpm")],
    ["Spin axis", formatMetric(shot.spinAxis, " deg")],
  ];

  return (
    <dl className="grid divide-y divide-border/70">
      {metrics.map(([label, value]) => (
        <div key={label} className="flex min-h-11 items-center justify-between gap-3 py-2">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-right text-sm font-semibold text-foreground tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MobileShotEvidenceRows({
  shots,
  selectedShotId,
  onSelect,
}: {
  shots: AnalysisShot[];
  selectedShotId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="ios-grouped-list overflow-hidden"
      aria-label="Measured shot evidence rows"
      data-mobile-shot-evidence
    >
      {shots.map((shot) => {
        const selected = shot.id === selectedShotId;
        return (
          <button
            key={shot.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(shot.id)}
            className={cn(
              "ios-grouped-row focus-aaa flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left outline-none",
              selected && "bg-primary/8",
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
              {shot.shotNumber ?? "-"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-foreground">
                {formatDate(shot.shotAt)}
              </span>
              <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">
                {shot.qualityTag ?? shot.shotCategory ?? "Measured shot"} ·{" "}
                {formatSide(shot.sideCarryYd)}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[15px] font-semibold text-foreground tabular-nums">
                {formatMetric(shot.carryYd, " yd")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {selected ? "Selected" : "Select"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ShotEvidenceWorkbench({
  shots,
  selectedShotId,
  clubModelName,
  clubTypeLabel,
  onSelect,
}: {
  shots: AnalysisShot[];
  selectedShotId: string;
  clubModelName: string;
  clubTypeLabel: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section
      id="club-shot-evidence-table"
      className="hidden scroll-mt-28 gap-3 lg:grid"
      data-workbench-scope="club-shot-evidence"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">Shot evidence table</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Desktop review of the shots feeding this club profile, matched to the selected date
            range.
          </p>
        </div>
        <span className="w-fit rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
          {shots.length} shot{shots.length === 1 ? "" : "s"} in view
        </span>
      </div>

      <DesktopTableWorkbenchControls
        viewKey={`club-shot-evidence-${clubTypeLabel}`}
        scope="club-shot-evidence"
        currentViewLabel={`${clubModelName} shot evidence`}
        resultLabel={`${shots.length} shots`}
        columns={clubShotEvidenceColumns}
        suggestedViews={clubShotEvidenceSuggestedViews}
        exportTableId="club-shot-evidence"
        exportFileName={`forekinghell-${clubTypeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-shot-evidence.csv`}
      />

      <DataTableFrame mainTable mainTableLabel="Club shot evidence table" stickyFirstColumn>
        <Table
          className="min-w-[1180px]"
          data-workbench-scope="club-shot-evidence"
          data-workbench-export-table="club-shot-evidence"
          aria-describedby="club-shot-evidence-summary"
        >
          <TableCaption id="club-shot-evidence-summary" className="sr-only">
            Club shot evidence table showing shot number, date, carry, total, offline distance, ball
            speed, club speed, launch, path, face, quality and selected-shot action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="shot"
                className="sticky left-0 z-20 min-w-28 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Shot
              </TableHead>
              <TableHead data-column="date">Date</TableHead>
              <TableHead data-column="carry" className="text-right">
                Carry
              </TableHead>
              <TableHead data-column="total" className="text-right">
                Total
              </TableHead>
              <TableHead data-column="offline" className="text-right">
                Offline
              </TableHead>
              <TableHead data-column="ball-speed" className="text-right">
                Ball speed
              </TableHead>
              <TableHead data-column="club-speed" className="text-right">
                Club speed
              </TableHead>
              <TableHead data-column="launch" className="text-right">
                Launch
              </TableHead>
              <TableHead data-column="path" className="text-right">
                Path
              </TableHead>
              <TableHead data-column="face" className="text-right">
                Face
              </TableHead>
              <TableHead data-column="quality">Quality</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shots.map((shot) => {
              const selected = shot.id === selectedShotId;

              return (
                <TableRow
                  key={shot.id}
                  tabIndex={0}
                  className={cn("focus-aaa outline-none", selected && "bg-emerald-50/80")}
                >
                  <TableCell
                    data-column="shot"
                    className="sticky left-0 z-10 min-w-28 bg-white font-semibold shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    #{shot.shotNumber ?? "-"}
                    {selected ? (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        selected
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell data-column="date">{formatDate(shot.shotAt)}</TableCell>
                  <TableCell data-column="carry" className="text-right">
                    {formatMetric(shot.carryYd, " yd")}
                  </TableCell>
                  <TableCell data-column="total" className="text-right">
                    {formatMetric(shot.totalYd, " yd")}
                  </TableCell>
                  <TableCell data-column="offline" className="text-right">
                    {formatSide(shot.sideCarryYd)}
                  </TableCell>
                  <TableCell data-column="ball-speed" className="text-right">
                    {formatMetric(shot.ballSpeedMph, " mph")}
                  </TableCell>
                  <TableCell data-column="club-speed" className="text-right">
                    {formatMetric(shot.clubSpeedMph, " mph")}
                  </TableCell>
                  <TableCell data-column="launch" className="text-right">
                    {formatMetric(shot.launchAngleDeg, " deg")}
                  </TableCell>
                  <TableCell data-column="path" className="text-right">
                    {formatMetric(shot.clubPathDeg, " deg")}
                  </TableCell>
                  <TableCell data-column="face" className="text-right">
                    {formatMetric(resolveClubFaceAngleDeg(shot), " deg")}
                  </TableCell>
                  <TableCell data-column="quality">
                    {shot.qualityTag ?? shot.shotCategory ?? "Unclassified"}
                  </TableCell>
                  <TableCell data-column="action" className="text-right">
                    <Button
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelect(shot.id)}
                      className={selected ? "bg-[#0B7A3B] text-white hover:bg-[#064E3B]" : ""}
                    >
                      {selected ? "Selected" : "Select"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  detail,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
        <Icon className="size-5" style={{ color: accent }} />
      </span>
      <span>
        <span className="block text-xl font-semibold tracking-normal">{title}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

function ShotHistory({
  groups,
  activeOpenDateKeys,
  selectedShotId,
  clubModelName,
  clubTypeLabel,
  accent,
  onToggleGroup,
  onSelect,
}: {
  groups: ReturnType<typeof groupShotsByDate>;
  activeOpenDateKeys: string[];
  selectedShotId: string;
  clubModelName: string;
  clubTypeLabel: string;
  accent: string;
  onToggleGroup: (dateKey: string, open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const allShots = groups.flatMap((group) => group.shots);
  const carryValues = allShots.map((shot) => shot.carryYd);
  const bestCarryYd = maxMetric(carryValues);
  const medianCarryYd = medianMetric(carryValues);
  const worstCarryYd = minMetric(carryValues);

  return (
    <Collapsible id="club-shot-history" className="group premium-card scroll-mt-28 overflow-hidden">
      <CollapsibleTrigger className="grid w-full cursor-pointer gap-3 px-4 py-4 text-left transition-colors hover:bg-emerald-50/35 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <span className="min-w-0">
          <span className="block text-xl font-semibold tracking-normal">
            Recent shots ({allShots.length})
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">
            Best {formatMetric(bestCarryYd)} yd · Median {formatMetric(medianCarryYd)} yd · Worst{" "}
            {formatMetric(worstCarryYd)} yd
          </span>
        </span>
        <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700">
          Expand
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-slate-200 bg-slate-50/45 p-3">
        {groups.map((group) => {
          const isOpen = activeOpenDateKeys.includes(group.dateKey);
          const selectedInGroup = group.shots.some((shot) => shot.id === selectedShotId);

          return (
            <Collapsible
              key={group.dateKey}
              open={isOpen}
              onOpenChange={(open) => onToggleGroup(group.dateKey, open)}
              className={cn(
                "group/date overflow-hidden rounded-lg border bg-white/88 shadow-sm ring-1 ring-slate-200/80",
                selectedInGroup && "border-emerald-300 ring-emerald-200",
              )}
            >
              <CollapsibleTrigger className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50">
                <span className="grid size-9 place-items-center rounded-full border bg-white text-muted-foreground">
                  <CalendarDays className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">
                    {group.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {group.shots.length} shot{group.shots.length === 1 ? "" : "s"} · best carry{" "}
                    {formatMetric(group.bestCarryYd)} yd
                  </span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]/date:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 border-t bg-slate-50/70 p-2 sm:p-3">
                {group.shots.map((shot) => (
                  <button
                    key={shot.id}
                    type="button"
                    onClick={() => onSelect(shot.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg bg-white/90 px-4 py-3 text-left text-sm ring-1 ring-slate-200/80 transition-colors hover:bg-white",
                      selectedShotId === shot.id && "ring-2",
                    )}
                    style={selectedShotId === shot.id ? { color: accent } : undefined}
                  >
                    <span className="grid size-8 place-items-center rounded-full border font-semibold">
                      {shot.shotNumber ?? "-"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {clubModelName}
                      </span>
                      {clubModelName !== clubTypeLabel ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {clubTypeLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-20 text-right font-medium text-foreground">
                      {formatMetric(shot.carryYd)} yd
                    </span>
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DispersionPanel({
  clubType,
  shots,
  selectedShotId,
  onSelect,
  distanceView,
  accent,
}: {
  clubType: string;
  shots: AnalysisShot[];
  selectedShotId: string;
  onSelect: (id: string) => void;
  distanceView: DistanceView;
  accent: string;
}) {
  const plottedShots = shots
    .map((shot) => ({
      shot,
      distance: distanceFor(shot, distanceView),
      side: shot.sideCarryYd ?? 0,
    }))
    .filter(
      (item): item is { shot: AnalysisShot; distance: number; side: number } =>
        item.distance !== null,
    );
  const distanceValues = plottedShots.map((item) => item.distance);
  const sideValues = plottedShots.map((item) => item.side);
  const holeYardage = 350;
  const maxDistance = Math.max(holeYardage, ...distanceValues) * 1.02;
  const maxSide = Math.max(55, ...sideValues.map(Math.abs)) * 1.15;
  const tee = { x: 322, y: 936 };
  const playHeight = 830;
  const sideScale = 158;
  const xFor = (side: number | null) => tee.x + ((side ?? 0) / maxSide) * sideScale;
  const yFor = (distance: number | null) => tee.y - ((distance ?? 0) / maxDistance) * playHeight;
  const plottedPoints = plottedShots.map((item) => ({
    id: item.shot.id,
    x: xFor(item.side),
    y: yFor(item.distance),
  }));
  const stockShotIds = new Set(
    selectStockYardageShots(shots, shots.length, { clubType }).filteredShots.map((shot) => shot.id),
  );
  const ellipse = buildDispersionEllipse(
    plottedPoints.filter((point) => stockShotIds.has(point.id)),
  );
  const yardMarkers = [50, 100, 150, 200, 250, 300, 350].filter((yard) => yard <= maxDistance);
  const coneTopY = yFor(Math.min(holeYardage, maxDistance));
  const coneLeftX = xFor(-maxSide);
  const coneRightX = xFor(maxSide);

  return (
    <div className="overflow-hidden rounded-xl border bg-[#172f1d] shadow-sm">
      <svg
        viewBox="0 0 644 1024"
        className="h-[560px] w-full max-h-[88vh] sm:h-[760px] lg:h-[820px]"
      >
        <defs>
          <filter id="shotGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <image
          href="/assets/hole-350-aerial.jpg"
          x="0"
          y="0"
          width="644"
          height="1024"
          preserveAspectRatio="xMidYMid slice"
        />
        <rect x="0" y="0" width="644" height="1024" fill="#020617" opacity="0.10" />

        <path
          d={`M ${tee.x} ${tee.y} L ${coneLeftX} ${coneTopY} Q ${tee.x} ${coneTopY - 48} ${coneRightX} ${coneTopY} Z`}
          fill={accent}
          fillOpacity="0.13"
          stroke={accent}
          strokeWidth="3"
          strokeOpacity="0.72"
          strokeLinejoin="round"
        />
        <line
          x1={tee.x}
          x2={tee.x}
          y1={coneTopY}
          y2={tee.y}
          stroke="#ffffff"
          strokeOpacity="0.86"
          strokeWidth="2.5"
        />
        <line
          x1={tee.x}
          x2={tee.x}
          y1={coneTopY}
          y2={tee.y}
          stroke="#111827"
          strokeOpacity="0.16"
          strokeWidth="6"
        />

        {yardMarkers.map((yard) => {
          const y = yFor(yard);
          const arcWidth = 70 + (yard / holeYardage) * 248;
          return (
            <g key={yard}>
              <path
                d={`M ${tee.x - arcWidth} ${y + 22} Q ${tee.x} ${y - 24} ${tee.x + arcWidth} ${y + 22}`}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.74"
                strokeWidth="2.5"
                strokeDasharray="10 10"
              />
              <text
                x={Math.min(592, tee.x + arcWidth + 12)}
                y={y + 12}
                fill="#ffffff"
                fontSize="20"
                fontWeight="700"
              >
                {yard}
              </text>
            </g>
          );
        })}

        {[-40, -20, 20, 40].map((side) => (
          <line
            key={side}
            x1={xFor(side)}
            x2={xFor(side)}
            y1={coneTopY + 8}
            y2={tee.y}
            stroke="#ffffff"
            strokeDasharray="9 12"
            strokeOpacity="0.36"
            strokeWidth="2"
          />
        ))}

        {ellipse ? (
          <ellipse
            cx={ellipse.cx}
            cy={ellipse.cy}
            rx={ellipse.rx}
            ry={ellipse.ry}
            transform={`rotate(${ellipse.rotationDeg} ${ellipse.cx} ${ellipse.cy})`}
            fill={accent}
            fillOpacity="0.08"
            stroke={accent}
            strokeWidth="3"
            strokeOpacity="0.86"
          />
        ) : null}
        {plottedShots.map((item) => {
          const selected = item.shot.id === selectedShotId;
          return (
            <circle
              key={item.shot.id}
              cx={xFor(item.side)}
              cy={yFor(item.distance)}
              r={selected ? 8 : 5}
              fill={selected ? accent : "#f8fafc"}
              opacity={selected ? 1 : 0.82}
              stroke={selected ? "#111827" : accent}
              strokeWidth={selected ? 2.5 : 1.5}
              filter={selected ? "url(#shotGlow)" : undefined}
              onClick={() => onSelect(item.shot.id)}
              className="cursor-pointer"
            />
          );
        })}

        <circle cx={tee.x} cy={tee.y} r="8" fill="#f8fafc" stroke="#111827" strokeWidth="3" />
        <text
          x={tee.x}
          y={tee.y + 34}
          fill="#ffffff"
          fontSize="18"
          fontWeight="700"
          textAnchor="middle"
        >
          Tee
        </text>

        <g>
          {[-40, -20, 0, 20, 40].map((side) => (
            <text
              key={side}
              x={xFor(side)}
              y="1000"
              fill="#e5e7eb"
              fontSize="17"
              fontWeight="700"
              textAnchor="middle"
            >
              {side === 0 ? "0" : `${Math.abs(side)}${side < 0 ? "L" : "R"}`}
            </text>
          ))}
          <text
            x="28"
            y="935"
            fill="#e5e7eb"
            fontSize="17"
            fontWeight="700"
            transform="rotate(-90 28 935)"
          >
            {distanceView === "carry" ? "Carry yd" : "Total yd"}
          </text>
        </g>
      </svg>
      <ChartAccessibleFallback
        title={`${clubType} dispersion map`}
        summary={dispersionFallbackSummary({
          plottedShotCount: plottedShots.length,
          distanceView,
          selectedShot: shots.find((shot) => shot.id === selectedShotId) ?? null,
          ellipse,
        })}
        columns={[
          { key: "shot", label: "Shot" },
          { key: "distance", label: distanceView === "carry" ? "Carry" : "Total" },
          { key: "offline", label: "Offline" },
          { key: "status", label: "Status" },
        ]}
        rows={dispersionFallbackRows(plottedShots, selectedShotId, distanceView)}
        className="mx-3 mb-3 bg-white/95"
      />
    </div>
  );
}

function TrajectoryPanel({
  shots,
  selectedShotId,
  accent,
}: {
  shots: AnalysisShot[];
  selectedShotId: string;
  accent: string;
}) {
  const maxDistance =
    Math.max(240, ...shots.map((shot) => shot.totalYd ?? shot.carryYd ?? 0)) * 1.05;
  const maxApex = Math.max(130, ...shots.map((shot) => shot.apexFt ?? 0)) * 1.05;
  const xFor = (distance: number | null) => 55 + ((distance ?? 0) / maxDistance) * 790;
  const yForApex = (apex: number | null) => 300 - ((apex ?? 0) / maxApex) * 245;

  const trajectoryShots = shots.filter((shot) => (shot.carryYd ?? shot.totalYd) !== null);

  return (
    <div className="apple-panel grid gap-3 p-3 shadow-sm">
      <svg
        viewBox="0 0 900 330"
        className="h-[320px] w-full"
        role="img"
        aria-label="Club trajectory"
      >
        <rect x="0" y="0" width="900" height="330" fill="#f7f8fb" />
        <path
          d="M40 260 C250 225 520 230 860 250 L860 300 L40 300 Z"
          fill="#22c55e"
          opacity="0.38"
        />
        <path
          d="M40 210 C250 180 560 185 860 205 L860 250 C520 230 250 225 40 260 Z"
          fill="#d1d5db"
          opacity="0.35"
        />
        {[50, 100, 150, 200, 250].map((yard) => (
          <g key={yard}>
            <line x1={xFor(yard)} x2={xFor(yard)} y1="25" y2="300" stroke="#d1d5db" />
            <text x={xFor(yard) - 10} y="316" fill="#9ca3af" fontSize="13">
              {yard}
            </text>
          </g>
        ))}
        {[40, 80, 120].map((height) => (
          <g key={height}>
            <line x1="40" x2="860" y1={yForApex(height)} y2={yForApex(height)} stroke="#e5e7eb" />
            <text x="865" y={yForApex(height) + 4} fill="#9ca3af" fontSize="13">
              {height}
            </text>
          </g>
        ))}
        {shots.map((shot) => {
          const endDistance = shot.carryYd ?? shot.totalYd;
          if (endDistance === null) {
            return null;
          }
          const selected = shot.id === selectedShotId;
          const endX = xFor(endDistance);
          const apexX = xFor(endDistance * 0.56);
          const apexY = yForApex(shot.apexFt);

          return (
            <path
              key={shot.id}
              d={`M55 300 Q ${apexX} ${apexY} ${endX} 300`}
              fill="none"
              stroke={accent}
              strokeWidth={selected ? 4 : 2}
              opacity={selected ? 1 : 0.22}
            />
          );
        })}
      </svg>
      <ChartAccessibleFallback
        title="Club trajectory"
        summary={trajectoryFallbackSummary(
          trajectoryShots,
          shots.find((shot) => shot.id === selectedShotId) ?? null,
        )}
        columns={[
          { key: "shot", label: "Shot" },
          { key: "carry", label: "Carry" },
          { key: "total", label: "Total" },
          { key: "apex", label: "Apex" },
          { key: "status", label: "Status" },
        ]}
        rows={trajectoryFallbackRows(trajectoryShots, selectedShotId)}
        className="bg-white/80"
      />
    </div>
  );
}

function dispersionFallbackSummary({
  plottedShotCount,
  distanceView,
  selectedShot,
  ellipse,
}: {
  plottedShotCount: number;
  distanceView: DistanceView;
  selectedShot: AnalysisShot | null;
  ellipse: ReturnType<typeof buildDispersionEllipse>;
}) {
  const selectedDistance = selectedShot ? distanceFor(selectedShot, distanceView) : null;
  const selectedText = selectedShot
    ? `Selected ${shotFallbackLabel(selectedShot)} is ${formatMetric(selectedDistance, " yd")} with ${formatSide(
        selectedShot.sideCarryYd,
      )} offline.`
    : "No selected shot is available.";
  const ellipseText = ellipse
    ? "A stock-shot dispersion ellipse is visible for the clean stock sample."
    : "Stock-shot ellipse needs more clean stock shots.";

  return `${plottedShotCount} shots are plotted by ${distanceView} distance and offline carry. ${selectedText} ${ellipseText}`;
}

function dispersionFallbackRows(
  plottedShots: Array<{ shot: AnalysisShot; distance: number; side: number }>,
  selectedShotId: string,
  distanceView: DistanceView,
) {
  return plottedShots.slice(0, 25).map((item, index) => ({
    _key: item.shot.id,
    shot: shotFallbackLabel(item.shot, index),
    distance: formatMetric(item.distance, " yd"),
    offline: formatSide(item.side),
    status: item.shot.id === selectedShotId ? "Selected" : distanceView,
  }));
}

function trajectoryFallbackSummary(shots: AnalysisShot[], selectedShot: AnalysisShot | null) {
  const selectedText = selectedShot
    ? `Selected ${shotFallbackLabel(selectedShot)} carries ${formatMetric(
        selectedShot.carryYd,
        " yd",
      )}, totals ${formatMetric(selectedShot.totalYd, " yd")} and reaches ${formatMetric(
        selectedShot.apexFt,
        " ft",
      )} apex.`
    : "No selected shot is available.";

  return `${shots.length} shots are plotted by distance and apex height. ${selectedText}`;
}

function trajectoryFallbackRows(shots: AnalysisShot[], selectedShotId: string) {
  return shots.slice(0, 25).map((shot, index) => ({
    _key: shot.id,
    shot: shotFallbackLabel(shot, index),
    carry: formatMetric(shot.carryYd, " yd"),
    total: formatMetric(shot.totalYd, " yd"),
    apex: formatMetric(shot.apexFt, " ft"),
    status: shot.id === selectedShotId ? "Selected" : "Plotted",
  }));
}

function shotFallbackLabel(shot: AnalysisShot, index = 0) {
  return shot.shotNumber ? `Shot ${shot.shotNumber}` : `Shot ${index + 1}`;
}

function ClubDataPanel({
  clubType,
  selectedShot,
  accent,
}: {
  clubType: string;
  selectedShot: AnalysisShot | null;
  accent: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ClubGraphicCard
        titleLeft="Launch angle"
        valueLeft={formatMetric(selectedShot?.launchAngleDeg ?? null, " deg")}
        titleRight="Spin rate"
        valueRight={formatMetric(selectedShot?.spinRate ?? null, " rpm")}
        footerLeft="Attack angle"
        footerLeftValue={formatMetric(selectedShot?.attackAngleDeg ?? null, " deg")}
        footerRight="Descent"
        footerRightValue={formatMetric(selectedShot?.descentAngleDeg ?? null, " deg")}
        accent={accent}
        mode="loft"
        clubType={clubType}
        selectedShot={selectedShot}
      />
      <ClubGraphicCard
        titleLeft="Club path"
        valueLeft={formatMetric(selectedShot?.clubPathDeg ?? null, " deg")}
        titleRight="Face angle"
        valueRight={formatMetric(resolveClubFaceAngleDeg(selectedShot ?? {}), " deg")}
        footerLeft="Smash"
        footerLeftValue={formatMetric(selectedShot?.smashFactor ?? null)}
        footerRight="Spin axis"
        footerRightValue={formatMetric(selectedShot?.spinAxis ?? null, " deg")}
        accent={accent}
        mode="path"
        clubType={clubType}
        selectedShot={selectedShot}
      />
    </div>
  );
}

function ClubGraphicCard({
  titleLeft,
  valueLeft,
  titleRight,
  valueRight,
  footerLeft,
  footerLeftValue,
  footerRight,
  footerRightValue,
  accent,
  mode,
  clubType,
  selectedShot,
}: {
  titleLeft: string;
  valueLeft: string;
  titleRight: string;
  valueRight: string;
  footerLeft: string;
  footerLeftValue: string;
  footerRight: string;
  footerRightValue: string;
  accent: string;
  mode: "loft" | "path";
  clubType: string;
  selectedShot: AnalysisShot | null;
}) {
  return (
    <div className="apple-panel-strong relative min-h-[390px] overflow-hidden p-5 shadow-sm">
      <div className="flex justify-between gap-6">
        <MetricCorner label={titleLeft} value={valueLeft} accent={accent} />
        <MetricCorner label={titleRight} value={valueRight} accent={accent} align="right" />
      </div>
      <svg
        viewBox="0 0 560 280"
        className="absolute inset-x-0 top-20 mx-auto h-60 w-full max-w-[560px]"
        aria-hidden="true"
      >
        {mode === "loft" ? (
          <LoftGraphic accent={accent} clubType={clubType} shot={selectedShot} />
        ) : (
          <PathGraphic accent={accent} clubType={clubType} shot={selectedShot} />
        )}
      </svg>
      <div className="absolute inset-x-5 bottom-5 flex justify-between gap-6">
        <MetricCorner label={footerLeft} value={footerLeftValue} accent={accent} />
        <MetricCorner label={footerRight} value={footerRightValue} accent={accent} align="right" />
      </div>
    </div>
  );
}

function MetricCorner({
  label,
  value,
  accent,
  align = "left",
}: {
  label: string;
  value: string;
  accent: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-lg font-semibold tracking-normal text-foreground">{label}</p>
      <p className="text-lg font-medium" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function LoftGraphic({
  accent,
  clubType,
  shot,
}: {
  accent: string;
  clubType: string;
  shot: AnalysisShot | null;
}) {
  const launchAngle = clamp(shot?.launchAngleDeg ?? 12, -2, 32);
  const attackAngle = clamp(shot?.attackAngleDeg ?? 0, -10, 10);
  const descentAngle = clamp(shot?.descentAngleDeg ?? 34, 18, 60);
  const impact = { x: 286, y: 199 - attackAngle * 1.3 };
  const launchLine = lineFromAngle(impact.x, impact.y, launchAngle, 172);
  const attackStart = {
    x: impact.x - 150,
    y: impact.y + attackAngle * 5.2,
  };
  const descentLine = lineFromAngle(launchLine.x2 - 16, launchLine.y2 - 2, -descentAngle, 70);
  const loftRotation = clamp(-72 + launchAngle * 0.85, -80, -44);
  const clubRotation = clamp(attackAngle * -1.35, -14, 14);

  return (
    <g>
      <defs>
        <filter id="clubAssetShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#020617" floodOpacity="0.14" />
        </filter>
      </defs>

      <rect x="92" y="218" width="370" height="2" fill="#4f46e5" opacity="0.65" />
      <line
        x1={attackStart.x}
        y1={attackStart.y}
        x2={impact.x}
        y2={impact.y}
        stroke="#2563eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1={impact.x}
        y1={impact.y}
        x2={launchLine.x2}
        y2={launchLine.y2}
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1={impact.x + 8}
        y1={impact.y + 5}
        x2={descentLine.x2}
        y2={descentLine.y2}
        stroke="#6b7280"
        strokeDasharray="7 8"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d={`M ${impact.x - 25} ${impact.y - 8} A 76 76 0 0 1 ${impact.x + 22} ${impact.y - 77} L ${impact.x + 28} ${impact.y - 24} A 32 32 0 0 0 ${impact.x + 6} ${impact.y - 8} Z`}
        fill="#d1d5db"
        opacity="0.72"
        transform={`rotate(${loftRotation + 58} ${impact.x} ${impact.y})`}
      />

      <g
        transform={`rotate(${clubRotation} ${impact.x} ${impact.y})`}
        filter="url(#clubAssetShadow)"
      >
        <SideClub clubType={clubType} impactX={impact.x} impactY={impact.y} accent={accent} />
      </g>
      <GolfBall cx={impact.x + 116} cy={impact.y - 1} r={27} />
      <text x={impact.x + 100} y={impact.y - 82} fill="#94a3b8" fontSize="12" textAnchor="middle">
        launch {numberFormatter.format(launchAngle)} deg
      </text>
    </g>
  );
}

function PathGraphic({
  accent,
  clubType,
  shot,
}: {
  accent: string;
  clubType: string;
  shot: AnalysisShot | null;
}) {
  const pathDeg = clamp(shot?.clubPathDeg ?? 0, -12, 12);
  const launchDirectionDeg = clamp(shot?.launchDirectionDeg ?? 0, -12, 12);
  const faceAngleDeg = clamp(resolveClubFaceAngleDeg(shot ?? {}) ?? 0, -12, 12);
  const spinAxisDeg = clamp(shot?.spinAxis ?? shot?.sideCarryYd ?? 0, -45, 45);
  const pathVisualAngle = pathDeg * 2.4;
  const launchVisualAngle = launchDirectionDeg * 2.8;
  const faceVisualAngle = faceAngleDeg * 2.8;
  const center = { x: 268, y: 138 };
  const pathLine = centeredLine(center.x, center.y, pathVisualAngle, 370);
  const launchLine = centeredLine(center.x + 12, center.y - 8, launchVisualAngle, 250);
  const targetLine = centeredLine(center.x, center.y, 0, 350);
  const spinCurve = spinAxisDeg * 0.9;
  const clubRotation = clamp(pathDeg * 1.65, -22, 22);

  return (
    <g>
      <defs>
        <filter id="topClubAssetShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#020617" floodOpacity="0.14" />
        </filter>
      </defs>

      <line
        x1={targetLine.x1}
        y1={targetLine.y1}
        x2={targetLine.x2}
        y2={targetLine.y2}
        stroke="#6b7280"
        strokeDasharray="8 8"
        strokeWidth="2"
      />
      <line
        x1={pathLine.x1}
        y1={pathLine.y1}
        x2={pathLine.x2}
        y2={pathLine.y2}
        stroke="#2563eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d={`M ${center.x - 5} ${center.y - 2} C ${center.x + 70} ${center.y - 28 - spinCurve}, ${center.x + 132} ${center.y - 22 + spinCurve}, ${center.x + 214} ${center.y - 18 + spinCurve * 0.35}`}
        fill="none"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1={launchLine.x1 + 88}
        y1={launchLine.y1 + 8}
        x2={launchLine.x2}
        y2={launchLine.y2}
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
      />

      <g
        transform={`rotate(${clubRotation} ${center.x} ${center.y})`}
        filter="url(#topClubAssetShadow)"
      >
        <TopClub clubType={clubType} centerX={center.x} centerY={center.y} accent={accent} />
      </g>
      <GolfBall cx={392} cy={center.y + 4} r={27} />

      <line
        x1={center.x - 12}
        y1={center.y + 10}
        x2={center.x - 12}
        y2={center.y + 110}
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
        transform={`rotate(${faceVisualAngle} ${center.x - 12} ${center.y + 10})`}
      />
      <text x="94" y="242" fill="#94a3b8" fontSize="12">
        path {numberFormatter.format(pathDeg)} deg
      </text>
      <text x="382" y="242" fill="#94a3b8" fontSize="12">
        face {numberFormatter.format(faceAngleDeg)} deg
      </text>
    </g>
  );
}

function SideClub({
  clubType,
  impactX,
  impactY,
  accent,
}: {
  clubType: string;
  impactX: number;
  impactY: number;
  accent: string;
}) {
  const family = clubFamily(clubType);
  const isMetal = family === "driver" || family === "wood";
  const isWedge = family === "wedge";

  return (
    <g>
      <line
        x1={impactX - (isMetal ? 7 : 17)}
        y1={impactY - 24}
        x2={impactX - (isMetal ? 26 : 54)}
        y2={impactY - 172}
        stroke="#111827"
        strokeLinecap="round"
        strokeWidth={isMetal ? 8 : 7}
      />
      <line
        x1={impactX - (isMetal ? 7 : 17)}
        y1={impactY - 24}
        x2={impactX - (isMetal ? 26 : 54)}
        y2={impactY - 172}
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth={isMetal ? 2 : 1.5}
        opacity="0.35"
      />
      <rect
        x={impactX - (isMetal ? 22 : 49)}
        y={impactY - 62}
        width={isMetal ? 16 : 14}
        height="7"
        rx="3"
        fill={accent}
        opacity="0.9"
        transform={`rotate(-7 ${impactX - 16} ${impactY - 58})`}
      />

      {isMetal ? (
        <g>
          <path
            d={`M ${impactX - 108} ${impactY - 24}
              C ${impactX - 76} ${impactY - 54}, ${impactX - 16} ${impactY - 52}, ${impactX + 14} ${impactY - 18}
              C ${impactX + 28} ${impactY - 1}, ${impactX + 12} ${impactY + 22}, ${impactX - 34} ${impactY + 28}
              C ${impactX - 78} ${impactY + 34}, ${impactX - 112} ${impactY + 14}, ${impactX - 128} ${impactY - 5}
              C ${impactX - 123} ${impactY - 13}, ${impactX - 116} ${impactY - 20}, ${impactX - 108} ${impactY - 24} Z`}
            fill="#111827"
          />
          <path
            d={`M ${impactX - 104} ${impactY - 23}
              C ${impactX - 71} ${impactY - 45}, ${impactX - 21} ${impactY - 44}, ${impactX + 5} ${impactY - 17}
              C ${impactX - 23} ${impactY - 3}, ${impactX - 78} ${impactY + 3}, ${impactX - 118} ${impactY - 4}`}
            fill="none"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeWidth="3"
            opacity="0.22"
          />
          <path
            d={`M ${impactX - 104} ${impactY + 15} C ${impactX - 64} ${impactY + 28}, ${impactX - 8} ${impactY + 18}, ${impactX + 13} ${impactY - 8}`}
            fill="none"
            stroke={accent}
            strokeLinecap="round"
            strokeWidth="2"
            opacity="0.8"
          />
        </g>
      ) : (
        <g>
          <path
            d={`M ${impactX - 86} ${impactY - 34}
              L ${impactX - 9} ${impactY - 10}
              L ${impactX + 3} ${impactY + 26}
              C ${impactX - 28} ${impactY + 36}, ${impactX - 69} ${impactY + 31}, ${impactX - 103} ${impactY + 8}
              C ${impactX - 98} ${impactY - 10}, ${impactX - 93} ${impactY - 24}, ${impactX - 86} ${impactY - 34} Z`}
            fill="#d9dee7"
            stroke="#6b7280"
            strokeWidth="2"
          />
          <path
            d={`M ${impactX - 76} ${impactY - 21} L ${impactX - 12} ${impactY - 3} L ${impactX - 4} ${impactY + 17}
              C ${impactX - 28} ${impactY + 22}, ${impactX - 61} ${impactY + 18}, ${impactX - 91} ${impactY + 2} Z`}
            fill="#f8fafc"
            opacity="0.74"
          />
          {[0, 1, 2, 3].map((index) => (
            <line
              key={index}
              x1={impactX - 76 + index * 13}
              y1={impactY - 12 + index * 2}
              x2={impactX - 24 + index * 10}
              y2={impactY + 3 + index * 2}
              stroke="#94a3b8"
              strokeWidth="1.4"
              opacity="0.72"
            />
          ))}
          <path
            d={`M ${impactX - 103} ${impactY + 8} C ${impactX - 74} ${impactY + 26}, ${impactX - 31} ${impactY + 31}, ${impactX + 2} ${impactY + 23}`}
            fill="none"
            stroke={accent}
            strokeLinecap="round"
            strokeWidth={isWedge ? 3 : 2}
            opacity="0.75"
          />
        </g>
      )}
    </g>
  );
}

function TopClub({
  clubType,
  centerX,
  centerY,
  accent,
}: {
  clubType: string;
  centerX: number;
  centerY: number;
  accent: string;
}) {
  const family = clubFamily(clubType);
  const isMetal = family === "driver" || family === "wood";
  const isWedge = family === "wedge";

  return (
    <g>
      <line
        x1={centerX - (isMetal ? 8 : 25)}
        y1={centerY - 96}
        x2={centerX - (isMetal ? 4 : 10)}
        y2={centerY - 12}
        stroke={isMetal ? "#111827" : "#6b7280"}
        strokeLinecap="round"
        strokeWidth={isMetal ? 8 : 7}
      />
      <line
        x1={centerX - (isMetal ? 8 : 25)}
        y1={centerY - 96}
        x2={centerX - (isMetal ? 4 : 10)}
        y2={centerY - 12}
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="1.5"
        opacity="0.34"
      />
      {isMetal ? (
        <g>
          <path
            d={`M ${centerX - 76} ${centerY - 44}
              C ${centerX - 37} ${centerY - 82}, ${centerX + 44} ${centerY - 54}, ${centerX + 57} ${centerY - 1}
              C ${centerX + 67} ${centerY + 42}, ${centerX + 22} ${centerY + 75}, ${centerX - 32} ${centerY + 53}
              C ${centerX - 82} ${centerY + 33}, ${centerX - 108} ${centerY - 10}, ${centerX - 76} ${centerY - 44} Z`}
            fill="#111827"
          />
          <path
            d={`M ${centerX - 50} ${centerY - 29}
              C ${centerX - 16} ${centerY - 58}, ${centerX + 40} ${centerY - 33}, ${centerX + 45} ${centerY + 4}
              C ${centerX + 14} ${centerY - 7}, ${centerX - 26} ${centerY - 4}, ${centerX - 76} ${centerY + 5}`}
            fill="none"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeWidth="5"
            opacity="0.18"
          />
          <path
            d={`M ${centerX - 75} ${centerY + 30} C ${centerX - 22} ${centerY + 58}, ${centerX + 38} ${centerY + 36}, ${centerX + 53} ${centerY + 3}`}
            fill="none"
            stroke={accent}
            strokeLinecap="round"
            strokeWidth="3"
            opacity="0.8"
          />
        </g>
      ) : (
        <g>
          <path
            d={`M ${centerX - 90} ${centerY - 20}
              C ${centerX - 50} ${centerY - 31}, ${centerX - 8} ${centerY - 19}, ${centerX + 35} ${centerY + 3}
              L ${centerX + 23} ${centerY + 28}
              C ${centerX - 18} ${centerY + 15}, ${centerX - 57} ${centerY + 14}, ${centerX - 96} ${centerY + 1} Z`}
            fill="#d9dee7"
            stroke="#64748b"
            strokeWidth="2"
          />
          <path
            d={`M ${centerX - 78} ${centerY - 10} C ${centerX - 42} ${centerY - 16}, ${centerX - 5} ${centerY - 5}, ${centerX + 21} ${centerY + 8}`}
            fill="none"
            stroke="#f8fafc"
            strokeLinecap="round"
            strokeWidth="6"
            opacity="0.78"
          />
          {[0, 1, 2, 3, 4].map((index) => (
            <line
              key={index}
              x1={centerX - 75 + index * 16}
              y1={centerY - 6 + index * 2}
              x2={centerX - 41 + index * 14}
              y2={centerY + 7 + index * 1.4}
              stroke="#94a3b8"
              strokeWidth="1.4"
              opacity="0.7"
            />
          ))}
          <path
            d={`M ${centerX - 94} ${centerY + 1} C ${centerX - 48} ${centerY + 20}, ${centerX - 8} ${centerY + 20}, ${centerX + 24} ${centerY + 27}`}
            fill="none"
            stroke={accent}
            strokeLinecap="round"
            strokeWidth={isWedge ? 3 : 2}
            opacity="0.75"
          />
        </g>
      )}
    </g>
  );
}

function clubFamily(clubType: string) {
  if (clubType === "driver") {
    return "driver";
  }

  if (clubType.endsWith("w") || clubType.endsWith("h")) {
    return "wood";
  }

  if (["pw", "sw", "gw", "lw"].includes(clubType)) {
    return "wedge";
  }

  return "iron";
}

function GolfBall({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const dimples = [
    [-0.42, -0.42],
    [0, -0.5],
    [0.42, -0.38],
    [-0.28, -0.08],
    [0.24, -0.08],
    [-0.42, 0.32],
    [0.02, 0.3],
    [0.44, 0.26],
  ];

  return (
    <g>
      <circle cx={cx + 3} cy={cy + 4} r={r} fill="#020617" opacity="0.08" />
      <circle cx={cx} cy={cy} r={r} fill="#f8fafc" stroke="#d1d5db" strokeWidth="1.5" />
      <circle cx={cx - r * 0.28} cy={cy - r * 0.32} r={r * 0.5} fill="#ffffff" opacity="0.7" />
      {dimples.map(([dx, dy]) => (
        <circle
          key={`${dx}-${dy}`}
          cx={cx + dx * r}
          cy={cy + dy * r}
          r={r * 0.085}
          fill="#cbd5e1"
          opacity="0.55"
        />
      ))}
    </g>
  );
}

function ShotMetricStrip({ shot, accent }: { shot: AnalysisShot | null; accent: string }) {
  const metrics = [
    {
      label: "Club Speed",
      value: formatMetric(shot?.clubSpeedMph ?? null),
      unit: "mph",
      tone: "sky" as const,
    },
    {
      label: "Attack Ang.",
      value: formatMetric(shot?.attackAngleDeg ?? null),
      unit: "deg",
      tone: angleTone(shot?.attackAngleDeg ?? null, 6, 10),
    },
    {
      label: "Ball Speed",
      value: formatMetric(shot?.ballSpeedMph ?? null),
      unit: "mph",
      tone: "sky" as const,
    },
    {
      label: "Spin Rate",
      value: formatMetric(shot?.spinRate ?? null),
      unit: "rpm",
      tone: "neutral" as const,
    },
    {
      label: "Carry",
      value: formatMetric(shot?.carryYd ?? null),
      unit: "yd",
      tone: "green" as const,
    },
    {
      label: "Side",
      value: formatSide(shot?.sideCarryYd ?? null),
      unit: "yd",
      tone: sideTone(shot?.sideCarryYd ?? null),
    },
    {
      label: "Launch",
      value: formatMetric(shot?.launchAngleDeg ?? null),
      unit: "deg",
      tone: launchTone(shot?.launchAngleDeg ?? null),
    },
    {
      label: "Apex",
      value: formatMetric(shot?.apexFt ?? null),
      unit: "ft",
      tone: "neutral" as const,
    },
    {
      label: "Path",
      value: formatMetric(shot?.clubPathDeg ?? null),
      unit: "deg",
      tone: angleTone(shot?.clubPathDeg ?? null, 4, 7),
    },
    {
      label: "Face",
      value: formatMetric(resolveClubFaceAngleDeg(shot ?? {})),
      unit: "deg",
      tone: angleTone(resolveClubFaceAngleDeg(shot ?? {}), 4, 7),
    },
    {
      label: "Smash",
      value: formatMetric(shot?.smashFactor ?? null),
      unit: "",
      tone: smashTone(shot?.smashFactor ?? null),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: accent }}>
        <BarChart3 className="size-4" />#{shot?.shotNumber ?? "-"}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn("rounded-lg p-3 text-center ring-1", metricToneClass(metric.tone))}
          >
            <p className="border-b border-current/15 pb-2 text-sm font-medium">{metric.label}</p>
            <p className="pt-2 text-xl font-semibold tracking-normal">{metric.value}</p>
            <p className="text-xs opacity-70">{metric.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function distanceFor(shot: AnalysisShot, distanceView: DistanceView) {
  return distanceView === "carry" ? shot.carryYd : (shot.totalYd ?? shot.carryYd);
}

function buildDispersionEllipse(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) {
    return null;
  }

  const cx = average(points.map((point) => point.x));
  const cy = average(points.map((point) => point.y));
  const varianceX = average(points.map((point) => (point.x - cx) ** 2));
  const varianceY = average(points.map((point) => (point.y - cy) ** 2));
  const covariance = average(points.map((point) => (point.x - cx) * (point.y - cy)));
  const eigenTerm = Math.sqrt(Math.max(0, (varianceX - varianceY) ** 2 + 4 * covariance ** 2));
  const majorVariance = Math.max(0, (varianceX + varianceY + eigenTerm) / 2);
  const minorVariance = Math.max(0, (varianceX + varianceY - eigenTerm) / 2);
  const rotationDeg = (0.5 * Math.atan2(2 * covariance, varianceX - varianceY) * 180) / Math.PI;

  return {
    cx,
    cy,
    rx: clamp(Math.sqrt(majorVariance) * 2.15, 18, 175),
    ry: clamp(Math.sqrt(minorVariance) * 2.15, 12, 120),
    rotationDeg,
  };
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function groupShotsByDate(shots: AnalysisShot[]) {
  const groups = new Map<
    string,
    {
      dateKey: string;
      label: string;
      shots: AnalysisShot[];
    }
  >();
  const orderedShots = [...shots].sort((left, right) => {
    const dateDifference = new Date(right.shotAt).getTime() - new Date(left.shotAt).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return Number(left.shotNumber ?? 0) - Number(right.shotNumber ?? 0);
  });

  for (const shot of orderedShots) {
    const dateKey = shotDateKey(shot.shotAt);
    const group = groups.get(dateKey) ?? {
      dateKey,
      label: formatDate(shot.shotAt),
      shots: [],
    };

    group.shots.push(shot);
    groups.set(dateKey, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    bestCarryYd: maxMetric(group.shots.map((shot) => shot.carryYd)),
  }));
}

function shotDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function maxMetric(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value !== null);

  return numericValues.length === 0 ? null : Math.max(...numericValues);
}

function minMetric(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value !== null);

  return numericValues.length === 0 ? null : Math.min(...numericValues);
}

function medianMetric(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value !== null);

  if (numericValues.length === 0) {
    return null;
  }

  const ordered = numericValues.sort((left, right) => left - right);
  const midpoint = (ordered.length - 1) / 2;
  const lower = Math.floor(midpoint);
  const upper = Math.ceil(midpoint);

  if (lower === upper) {
    return ordered[lower];
  }

  return (ordered[lower] + ordered[upper]) / 2;
}

type MetricTone = "green" | "amber" | "red" | "sky" | "neutral";

function metricToneClass(tone: MetricTone) {
  if (tone === "green") {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }

  if (tone === "amber") {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }

  if (tone === "red") {
    return "bg-red-50 text-red-800 ring-red-200";
  }

  if (tone === "sky") {
    return "bg-sky-50 text-sky-800 ring-sky-200";
  }

  return "bg-white/90 text-slate-800 ring-slate-200";
}

function angleTone(value: number | null, greenLimit: number, amberLimit: number): MetricTone {
  if (value === null) {
    return "neutral";
  }

  const absolute = Math.abs(value);

  if (absolute <= greenLimit) {
    return "green";
  }

  return absolute <= amberLimit ? "amber" : "red";
}

function sideTone(value: number | null): MetricTone {
  if (value === null) {
    return "neutral";
  }

  const absolute = Math.abs(value);

  if (absolute <= 10) {
    return "green";
  }

  return absolute <= 25 ? "amber" : "red";
}

function launchTone(value: number | null): MetricTone {
  if (value === null) {
    return "neutral";
  }

  if (value >= 8 && value <= 30) {
    return "green";
  }

  return value >= 4 && value <= 36 ? "amber" : "red";
}

function smashTone(value: number | null): MetricTone {
  if (value === null) {
    return "neutral";
  }

  if (value >= 1.28) {
    return "green";
  }

  return value >= 1.18 ? "amber" : "red";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMetric(value: number | null, suffix = "") {
  return value === null ? "-" : `${numberFormatter.format(value)}${suffix}`;
}

function formatSide(value: number | null) {
  if (value === null) {
    return "-";
  }

  if (value < 0) {
    return `${numberFormatter.format(Math.abs(value))}L`;
  }

  if (value > 0) {
    return `${numberFormatter.format(value)}R`;
  }

  return "0";
}

function lineFromAngle(x: number, y: number, angleDeg: number, length: number) {
  const radians = degToRad(angleDeg);

  return {
    x1: svgCoordinate(x),
    y1: svgCoordinate(y),
    x2: svgCoordinate(x + Math.cos(radians) * length),
    y2: svgCoordinate(y - Math.sin(radians) * length),
  };
}

function centeredLine(x: number, y: number, angleDeg: number, length: number) {
  const radians = degToRad(angleDeg);
  const dx = Math.cos(radians) * (length / 2);
  const dy = Math.sin(radians) * (length / 2);

  return {
    x1: svgCoordinate(x - dx),
    y1: svgCoordinate(y - dy),
    x2: svgCoordinate(x + dx),
    y2: svgCoordinate(y + dy),
  };
}

function svgCoordinate(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
