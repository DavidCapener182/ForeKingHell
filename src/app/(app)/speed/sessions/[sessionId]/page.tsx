import Link from "next/link";
import { getRequestAppSurface } from "@/lib/app-surface-server";
import { SpeedSessionCompanion } from "@/app/speed/speed-session-companion";
import { notFound } from "next/navigation";
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { ArrowLeft, Gauge, Link2, Save, Trash2 } from "lucide-react";

import {
  deleteSpeedSessionAction,
  saveSpeedTransferTestAction,
  updateSpeedSessionAction,
} from "@/app/speed/actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import {
  DesktopWorkbenchLayout,
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { SpeedFatigueChart } from "@/components/speed/speed-fatigue-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  DataPanel,
  DataTableFrame,
  EmptyState,
  PageHeader,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { requireCurrentUserId } from "@/lib/current-user";
import {
  getSpeedSessionDetailPageData,
  type SpeedSessionDetailPageData,
} from "@/lib/speed-training-data";
import { formatSpeed, formatSpeedCompact } from "@/lib/speed-training";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    speed_saved?: string | string[];
    speed_error?: string | string[];
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const speedSwingColumns: DesktopWorkbenchColumn[] = [
  { id: "swing", label: "Swing", locked: true },
  { id: "speed", label: "Speed" },
  { id: "vs-average", label: "Vs average" },
  { id: "vs-best", label: "Vs best" },
  { id: "rolling-three", label: "Rolling 3" },
  { id: "side", label: "Side" },
  { id: "phase", label: "Phase" },
  { id: "signal", label: "Signal", locked: true },
];

const speedSwingSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Swing log",
    href: "#speed-session-swing-log",
    detail: "Every recorded swing with speed deltas and session phase.",
  },
  {
    title: "Speed Centre",
    href: "/speed",
    detail: "Return to long-term speed trends and goals.",
  },
  {
    title: "Rapsodo inbox",
    href: "/rapsodo",
    detail: "Review imported sessions and source quality.",
  },
];

export default async function SpeedSessionPage({ params, searchParams }: PageProps) {
  const { sessionId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const userId = await requireCurrentUserId();
  const data = await getSpeedSessionDetailPageData(userId, sessionId);

  if (!data) {
    notFound();
  }

  const saved = firstSearchParam(resolvedSearchParams.speed_saved);
  const error = firstSearchParam(resolvedSearchParams.speed_error);
  if ((await getRequestAppSurface()) === "companion")
    return <SpeedSessionCompanion data={data} saved={saved} error={error} />;
  const peakSummary = data.peakSwingSummary;
  const peakAverageFallback = peakSummary.swingCount === 0 ? data.session.avgSpeedMph : null;
  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="speed-session">
        <PageHeader
          eyebrow={<StatusPill tone="sky">Speed session</StatusPill>}
          title={data.session.title ?? data.session.implementLabel}
          description={`${data.session.implementLabel} · ${formatDate(data.session.sessionDateIso)}`}
          metrics={[
            {
              label: "Median",
              value: formatSpeed(peakSummary.medianSpeedMph ?? peakAverageFallback),
              detail:
                peakSummary.swingCount > 0
                  ? `${peakSummary.swingCount} maximum-speed swings`
                  : "Manual speed summary",
            },
            {
              label: "Top 3 average",
              value: formatSpeed(peakSummary.bestThreeAvgMph ?? peakAverageFallback),
              detail: "Three fastest swings",
            },
            {
              label: "Top 5 average",
              value: formatSpeed(peakSummary.bestFiveAvgMph ?? peakAverageFallback),
              detail: "Five fastest swings",
            },
            {
              label: "Session best",
              value: formatSpeed(peakSummary.bestSwingMph ?? data.session.maxSpeedMph),
              detail: "Fastest single swing",
            },
          ]}
          actions={
            <Button asChild variant="outline">
              <Link href="/speed" prefetch={false}>
                <ArrowLeft aria-hidden="true" />
                Speed Centre
              </Link>
            </Button>
          }
        />

        {saved ? (
          <div className="rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-surface)] px-4 py-3 text-sm font-medium text-[var(--status-success-foreground)]">
            {speedSessionSavedMessage(saved)}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <DataPanel>
            <SectionHeader
              title="Swing detail"
              description="Warm-up, peak speed, and late-session drop-off."
              action={<StatusPill tone="green">{peakSummary.trendLabel}</StatusPill>}
            />
            <div className="grid gap-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <MetricCard
                  label="Median"
                  value={formatSpeed(peakSummary.medianSpeedMph ?? peakAverageFallback)}
                />
                <MetricCard
                  label="Top 3 average"
                  value={formatSpeed(peakSummary.bestThreeAvgMph ?? peakAverageFallback)}
                />
                <MetricCard
                  label="Top 5 average"
                  value={formatSpeed(peakSummary.bestFiveAvgMph ?? peakAverageFallback)}
                />
                <MetricCard
                  label="Session best"
                  value={formatSpeed(peakSummary.bestSwingMph ?? data.session.maxSpeedMph)}
                />
                <MetricCard
                  label="Warm-up median"
                  value={formatSpeed(data.phasedSummary.phases.warm_up.medianSpeedMph)}
                />
                <MetricCard label="Late change" value={formatGap(peakSummary.warmupGainMph)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3" aria-label="Speed session phases">
                <PhaseCard
                  title="Warm-up"
                  count={data.phasedSummary.phases.warm_up.swingCount}
                  value={formatSpeed(data.phasedSummary.phases.warm_up.medianSpeedMph)}
                  detail="Progressive preparation"
                />
                <PhaseCard
                  title="Maximum speed"
                  count={data.phasedSummary.phases.max_speed.swingCount}
                  value={formatSpeed(data.phasedSummary.phases.max_speed.sessionBestMph)}
                  detail="Session ceiling"
                />
                <PhaseCard
                  title="Transfer"
                  count={data.transferTest?.playability.measuredShotCount ?? 0}
                  value={
                    data.transferTest
                      ? `${data.transferTest.playability.inCorridorCount}/5`
                      : "Not linked"
                  }
                  detail="Normal Driver shots"
                />
              </div>

              {data.swings.length === 0 ? (
                <EmptyState
                  icon={<Gauge className="size-5" aria-hidden="true" />}
                  title="No individual swings"
                  description="This session only has summary numbers. Paste the swing readings below to rebuild detail."
                />
              ) : (
                <>
                  <SpeedFatigueChart
                    readings={data.swings.map((swing) => ({
                      swingNumber: swing.swingNumber,
                      clubSpeedMph: swing.clubSpeedMph,
                    }))}
                  />
                  <SwingLogWorkbench data={data} />
                </>
              )}
            </div>
          </DataPanel>

          <div className="grid gap-4">
            {data.canLinkTransferTest ? <SpeedTransferTestPanel data={data} /> : null}

            <DataPanel>
              <SectionHeader
                title="Edit session"
                description="Correct club, implement, side, target, or readings."
                action={<Save className="size-4 text-primary" aria-hidden="true" />}
              />
              <form action={updateSpeedSessionAction} className="grid gap-4 p-4">
                <input type="hidden" name="sessionId" value={data.session.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date">
                    <Input
                      name="sessionDate"
                      type="date"
                      defaultValue={dateInputValue(data.session.sessionDateIso)}
                    />
                  </Field>
                  <Field label="Title">
                    <Input name="title" defaultValue={data.session.title ?? ""} />
                  </Field>
                  <Field label="Implement">
                    <NativeSelect name="implementKind" defaultValue={data.session.implementKind}>
                      <option value="club">Golf club</option>
                      <option value="speed_stick">Speed stick</option>
                      <option value="weighted_club">Weighted club</option>
                      <option value="other">Other</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Side">
                    <NativeSelect name="handedness" defaultValue={data.session.handedness}>
                      <option value="dominant">Dominant side</option>
                      <option value="non_dominant">Non-dominant side</option>
                      <option value="both">Both sides</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Speed system">
                    <NativeSelect name="speedSystem" defaultValue={data.session.speedSystem ?? ""}>
                      <option value="">Standard club speed</option>
                      <option value="R-Speed">R-Speed</option>
                      <option value="Light speed stick">Light speed stick</option>
                      <option value="Medium speed stick">Medium speed stick</option>
                      <option value="Heavy speed stick">Heavy speed stick</option>
                      <option value="Stack">Stack</option>
                      <option value="Other">Other</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Target">
                    <Input
                      name="targetSpeedMph"
                      inputMode="decimal"
                      defaultValue={numberInputValue(data.session.targetSpeedMph)}
                    />
                  </Field>
                </div>

                <Field label="Club used">
                  <NativeSelect name="clubId" defaultValue={data.session.clubId ?? ""}>
                    <option value="">Not in bag / speed stick</option>
                    {data.clubOptions.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field label="Implement label">
                  <Input name="implementLabel" defaultValue={data.session.implementLabel} />
                </Field>

                <Field label="Warm-up swings">
                  <Textarea
                    name="warmupReadings"
                    rows={4}
                    defaultValue={data.swings
                      .filter((swing) => swing.phase === "warm_up")
                      .map((swing) => swing.clubSpeedMph)
                      .join("\n")}
                  />
                </Field>

                <Field label="Maximum-speed swings">
                  <Textarea
                    name="speedReadings"
                    rows={8}
                    defaultValue={data.swings
                      .filter((swing) => swing.phase === null || swing.phase === "max_speed")
                      .map((swing) => swing.clubSpeedMph)
                      .join("\n")}
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Min">
                    <Input
                      name="minSpeedMph"
                      inputMode="decimal"
                      defaultValue={numberInputValue(data.session.minSpeedMph)}
                    />
                  </Field>
                  <Field label="Average">
                    <Input
                      name="avgSpeedMph"
                      inputMode="decimal"
                      defaultValue={numberInputValue(data.session.avgSpeedMph)}
                    />
                  </Field>
                  <Field label="Max">
                    <Input
                      name="maxSpeedMph"
                      inputMode="decimal"
                      defaultValue={numberInputValue(data.session.maxSpeedMph)}
                    />
                  </Field>
                  <Field label="Count">
                    <Input
                      name="swingCount"
                      inputMode="numeric"
                      defaultValue={String(data.session.swingCount)}
                    />
                  </Field>
                </div>

                <Field label="Notes">
                  <Input name="notes" defaultValue={data.session.notes ?? ""} />
                </Field>

                <Button type="submit" className="w-full sm:w-fit">
                  <Save aria-hidden="true" />
                  Save changes
                </Button>
              </form>
            </DataPanel>

            <DataPanel>
              <SectionHeader
                title="Delete session"
                description="Remove this session and all swing readings."
                action={<Trash2 className="size-4 text-destructive" aria-hidden="true" />}
              />
              <form action={deleteSpeedSessionAction} className="p-4">
                <input type="hidden" name="sessionId" value={data.session.id} />
                <ConfirmSubmitButton
                  confirmMessage={`Delete speed session ${data.session.title ?? data.session.implementLabel}? This removes the session and all swing readings.`}
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  Delete session
                </ConfirmSubmitButton>
              </form>
            </DataPanel>
          </div>
        </div>
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function SpeedTransferTestPanel({ data }: { data: SpeedSessionDetailPageData }) {
  const linkedSessionId = data.transferTest?.metadata.shotSessionId ?? null;
  const candidates = [...data.transferCandidates];

  if (linkedSessionId && !candidates.some((candidate) => candidate.sessionId === linkedSessionId)) {
    candidates.unshift({
      sessionId: linkedSessionId,
      sessionDateIso: data.transferTest?.shots[0]?.shotAtIso ?? data.session.sessionDateIso,
      label: "Currently linked Driver session",
      eligibleShotCount: data.transferTest?.shots.length ?? 0,
      shots: data.transferTest?.shots ?? [],
    });
  }

  const playability = data.transferTest?.playability ?? null;
  const tone =
    playability?.status === "passed"
      ? "green"
      : playability?.status === "failed"
        ? "pink"
        : "slate";

  return (
    <DataPanel>
      <SectionHeader
        title="Five-shot transfer test"
        description="Link five normal Driver shots to this speed session. Playable means at least 4 of 5 finish inside your personal corridor."
        action={
          <StatusPill tone={tone}>
            {playability
              ? playability.status === "passed"
                ? "Passed"
                : playability.status === "failed"
                  ? "Failed"
                  : "Incomplete"
              : "Not linked"}
          </StatusPill>
        }
      />
      <div className="grid gap-4 p-4">
        {data.transferTest ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="Inside corridor"
                value={`${data.transferTest.playability.inCorridorCount}/5`}
              />
              <MetricCard
                label="Personal corridor"
                value={formatCorridor(data.transferTest.corridor)}
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {data.transferTest.corridor.basis === "personal_80_percent"
                ? `Based on the central 80% of ${data.transferTest.corridor.sampleSize} prior Driver shots.`
                : `Provisional ±30 yd Driver corridor until 10 historical side-carry readings are available.`}
            </p>
            <ol className="grid gap-1.5" aria-label="Linked five-shot transfer evidence">
              {data.transferTest.shots.map((shot, index) => {
                const inside =
                  shot.sideCarryYd !== null &&
                  shot.sideCarryYd >= data.transferTest!.corridor.minSideCarryYd &&
                  shot.sideCarryYd <= data.transferTest!.corridor.maxSideCarryYd;

                return (
                  <li
                    key={shot.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      Shot {shot.shotNumber ?? index + 1} · {formatSpeed(shot.clubSpeedMph)}
                    </span>
                    <span className={inside ? "text-primary" : "text-muted-foreground"}>
                      {formatSideCarry(shot.sideCarryYd)} · {inside ? "Inside" : "Outside"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
            The speed block is saved. Choose the matching Driver session below so the transfer
            result cannot be confused with an unrelated range session.
          </div>
        )}

        {candidates.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium text-foreground">
              Choose the exact five normal Driver shots
            </p>
            {candidates.map((candidate, candidateIndex) => {
              const currentLinkedIds =
                linkedSessionId === candidate.sessionId
                  ? new Set(data.transferTest?.metadata.shotIds ?? [])
                  : null;

              return (
                <details
                  key={candidate.sessionId}
                  open={candidate.sessionId === linkedSessionId || candidateIndex === 0}
                  className="rounded-lg border border-border/70 bg-card"
                >
                  <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-foreground">
                    {formatDate(candidate.sessionDateIso)} · {candidate.label} ·{" "}
                    {candidate.eligibleShotCount} eligible
                  </summary>
                  <form
                    action={saveSpeedTransferTestAction}
                    className="grid gap-3 border-t border-border/70 p-3"
                  >
                    <input type="hidden" name="speedSessionId" value={data.session.id} />
                    <input type="hidden" name="shotSessionId" value={candidate.sessionId} />
                    <div className="grid gap-1.5">
                      {candidate.shots.map((shot, index) => (
                        <label
                          key={shot.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              name="shotId"
                              value={shot.id}
                              defaultChecked={
                                currentLinkedIds?.has(shot.id) ??
                                (candidateIndex === 0 && index < 5)
                              }
                              className="size-4 rounded border-border accent-primary"
                            />
                            <span className="truncate font-medium text-foreground">
                              Shot {shot.shotNumber ?? index + 1}
                            </span>
                          </span>
                          <span className="text-right tabular-nums text-muted-foreground">
                            {formatSpeed(shot.clubSpeedMph)} · {formatSideCarry(shot.sideCarryYd)}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Button type="submit" variant="outline" className="w-full sm:w-fit">
                      <Link2 aria-hidden="true" />
                      Link selected five
                    </Button>
                  </form>
                </details>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No nearby Driver session has five eligible shots yet.
          </p>
        )}

        {linkedSessionId ? (
          <form action={saveSpeedTransferTestAction}>
            <input type="hidden" name="speedSessionId" value={data.session.id} />
            <input type="hidden" name="shotSessionId" value="" />
            <Button type="submit" variant="ghost" className="w-full sm:w-fit">
              Remove transfer link
            </Button>
          </form>
        ) : null}
      </div>
    </DataPanel>
  );
}

function SwingLogWorkbench({ data }: { data: SpeedSessionDetailPageData }) {
  const bestSwing = data.peakSwingSummary.bestSwingMph;
  const averageSwing = data.session.avgSpeedMph;

  return (
    <section
      id="speed-session-swing-log"
      className="grid gap-3"
      data-workbench-scope="speed-session-swings"
    >
      <DesktopTableWorkbenchControls
        viewKey={`speed-session-swings-${data.session.id}`}
        scope="speed-session-swings"
        currentViewLabel={`${data.session.implementLabel} swing log`}
        resultLabel={`${data.swings.length} swings`}
        columns={speedSwingColumns}
        suggestedViews={speedSwingSuggestedViews}
        exportTableId="speed-session-swings"
        exportFileName={`forekinghell-speed-session-${data.session.id}-swings.csv`}
      />

      <DataTableFrame mainTable mainTableLabel="Speed session swing log table" stickyFirstColumn>
        <Table
          data-workbench-export-table="speed-session-swings"
          aria-describedby="speed-session-swing-log-summary"
        >
          <TableCaption id="speed-session-swing-log-summary" className="sr-only">
            Speed session swing log table showing swing number, club speed, deltas from average and
            best, rolling three-swing speed, side, phase and performance signal.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
            <TableRow>
              <TableHead
                data-column="swing"
                className="sticky left-0 z-20 min-w-24 bg-card shadow-[1px_0_0_hsl(var(--border))]"
              >
                Swing
              </TableHead>
              <TableHead data-column="speed" className="text-right">
                Speed
              </TableHead>
              <TableHead data-column="vs-average" className="text-right">
                Vs average
              </TableHead>
              <TableHead data-column="vs-best" className="text-right">
                Vs best
              </TableHead>
              <TableHead data-column="rolling-three" className="text-right">
                Rolling 3
              </TableHead>
              <TableHead data-column="side">Side</TableHead>
              <TableHead data-column="phase">Phase</TableHead>
              <TableHead data-column="signal">Signal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.swings.map((swing, index) => {
              const rollingThree = rollingAverage(
                data.swings
                  .slice(Math.max(0, index - 2), index + 1)
                  .map((reading) => reading.clubSpeedMph),
              );
              const phase = swing.phase
                ? speedTrainingPhaseLabel(swing.phase)
                : speedSwingPhase(index, data.swings.length, swing.clubSpeedMph, bestSwing);
              const signal = speedSwingSignal(swing.clubSpeedMph, bestSwing, averageSwing);

              return (
                <TableRow key={swing.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="swing"
                    className="sticky left-0 z-10 min-w-24 bg-card font-semibold shadow-[1px_0_0_hsl(var(--border))]"
                  >
                    #{swing.swingNumber}
                  </TableCell>
                  <TableCell data-column="speed" className="text-right font-semibold">
                    {formatSpeedCompact(swing.clubSpeedMph)}
                  </TableCell>
                  <TableCell data-column="vs-average" className="text-right">
                    {formatDelta(swing.clubSpeedMph, averageSwing)}
                  </TableCell>
                  <TableCell data-column="vs-best" className="text-right">
                    {formatDelta(swing.clubSpeedMph, bestSwing)}
                  </TableCell>
                  <TableCell data-column="rolling-three" className="text-right">
                    {formatSpeedCompact(rollingThree)}
                  </TableCell>
                  <TableCell data-column="side">{formatSwingSide(swing.swingSide)}</TableCell>
                  <TableCell data-column="phase">{phase}</TableCell>
                  <TableCell data-column="signal">{signal}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function PhaseCard({
  title,
  count,
  value,
  detail,
}: {
  title: string;
  count: number;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <StatusPill tone={count > 0 ? "sky" : "slate"}>{count} recorded</StatusPill>
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NativeSelect({
  className,
  children,
  name,
  defaultValue,
  disabled,
  required,
  id,
  "aria-label": ariaLabel,
}: ComponentProps<"select">) {
  const options = Children.toArray(children).filter(
    (child): child is ReactElement<ComponentProps<"option">> =>
      isValidElement<ComponentProps<"option">>(child) && child.type === "option",
  );
  const initialValue =
    typeof defaultValue === "string" || typeof defaultValue === "number"
      ? String(defaultValue)
      : "";

  return (
    <Select
      name={name}
      defaultValue={initialValue || "__none__"}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("h-8 w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option, index) => {
          const value = String(option.props.value ?? "") || "__none__";
          return (
            <SelectItem key={`${value}:${index}`} value={value} disabled={option.props.disabled}>
              {option.props.children}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date unknown";
  }

  return dateFormatter.format(new Date(value));
}

function speedSessionSavedMessage(value: string) {
  if (value === "transfer") {
    return "Five-shot Driver transfer test linked to this speed session.";
  }

  if (value === "transfer_cleared") {
    return "Transfer-test link removed.";
  }

  return "Speed session updated.";
}

function speedTrainingPhaseLabel(value: "warm_up" | "max_speed" | "transfer") {
  switch (value) {
    case "warm_up":
      return "Warm-up";
    case "max_speed":
      return "Maximum speed";
    case "transfer":
      return "Transfer";
  }
}

function formatCorridor(corridor: { minSideCarryYd: number; maxSideCarryYd: number }) {
  return `${formatSignedYards(corridor.minSideCarryYd)} to ${formatSignedYards(corridor.maxSideCarryYd)}`;
}

function formatSideCarry(value: number | null) {
  return value === null ? "No side data" : formatSignedYards(value);
}

function formatSignedYards(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} yd`;
}

function formatGap(value: number | null) {
  if (value === null) {
    return "-";
  }

  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} mph`;
}

function firstSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw || null;
}

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function numberInputValue(value: number | null) {
  return value === null ? "" : String(value);
}

function rollingAverage(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDelta(value: number, baseline: number | null) {
  if (baseline === null) {
    return "-";
  }

  const delta = Math.round((value - baseline) * 10) / 10;
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)} mph`;
}

function formatSwingSide(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function speedSwingPhase(
  index: number,
  swingCount: number,
  speed: number,
  bestSpeed: number | null,
) {
  if (bestSpeed !== null && speed === bestSpeed) {
    return "Peak";
  }

  if (index < 5) {
    return "Warm-up";
  }

  if (index >= Math.max(0, swingCount - 5)) {
    return "Finish";
  }

  return "Build";
}

function speedSwingSignal(speed: number, bestSpeed: number | null, averageSpeed: number | null) {
  if (bestSpeed !== null && speed === bestSpeed) {
    return "Fastest";
  }

  if (averageSpeed !== null && speed >= averageSpeed) {
    return "Above average";
  }

  return "Below average";
}
