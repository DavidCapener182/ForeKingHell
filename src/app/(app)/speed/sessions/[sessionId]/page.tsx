import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, Gauge, Save, Trash2 } from "lucide-react";

import { deleteSpeedSessionAction, updateSpeedSessionAction } from "@/app/speed/actions";
import { ConfirmSubmitButton } from "@/components/app/confirm-submit-button";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import {
  DesktopWorkbenchLayout,
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    edit?: string | string[];
    speed_saved?: string | string[];
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
  const editRequested = firstSearchParam(resolvedSearchParams.edit) === "1";

  return (
    <PageShell>
      <div className="grid min-w-0 gap-4 lg:hidden">
        <MobileSpeedSessionAnswer data={data} saved={saved !== null} />
        <MobileSpeedSessionDisclosures data={data} openEditByDefault={editRequested} />
      </div>

      <div className="hidden lg:contents">
        <DesktopWorkbenchLayout scope="speed-session">
          <PageHeader
            eyebrow={<StatusPill tone="sky">Speed session</StatusPill>}
            title={data.session.title ?? data.session.implementLabel}
            description={`${data.session.implementLabel} · ${formatDate(data.session.sessionDateIso)}`}
            metrics={[
              {
                label: "Average",
                value: formatSpeed(data.session.avgSpeedMph),
                detail: `${data.session.swingCount} swings`,
              },
              {
                label: "Best",
                value: formatSpeed(data.swingSummary.bestSwingMph),
                detail: "Fastest swing",
              },
              {
                label: "Best 3",
                value: formatSpeed(data.swingSummary.bestThreeAvgMph),
                detail: "Peak quality",
              },
              {
                label: "Finish",
                value: formatSpeed(data.swingSummary.lastFiveAvgMph),
                detail: data.swingSummary.trendLabel,
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
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
              Speed session updated.
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <DataPanel>
              <SectionHeader
                title="Swing detail"
                description="Warm-up, peak speed, and late-session drop-off."
                action={<StatusPill tone="green">{data.swingSummary.trendLabel}</StatusPill>}
              />
              <div className="grid gap-4 p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <MetricCard
                    label="Best swing"
                    value={formatSpeed(data.swingSummary.bestSwingMph)}
                  />
                  <MetricCard
                    label="Best 3 avg"
                    value={formatSpeed(data.swingSummary.bestThreeAvgMph)}
                  />
                  <MetricCard
                    label="First 5"
                    value={formatSpeed(data.swingSummary.firstFiveAvgMph)}
                  />
                  <MetricCard
                    label="Last 5"
                    value={formatSpeed(data.swingSummary.lastFiveAvgMph)}
                  />
                  <MetricCard
                    label="Late change"
                    value={formatGap(data.swingSummary.warmupGainMph)}
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
                    <SwingLogWorkbench data={data} />
                    <div className="grid gap-2 sm:hidden">
                      {data.swings.map((swing) => (
                        <div
                          key={swing.id}
                          className="grid grid-cols-[52px_1fr] items-center gap-3 rounded-lg border border-border/70 bg-white/65 px-3 py-2"
                        >
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-700">
                            #{swing.swingNumber}
                          </span>
                          <span className="text-lg font-semibold tabular-nums text-slate-950">
                            {formatSpeedCompact(swing.clubSpeedMph)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </DataPanel>

            <div className="grid gap-4">
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
                      <NativeSelect
                        name="speedSystem"
                        defaultValue={data.session.speedSystem ?? ""}
                      >
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

                  <Field label="Swing speeds">
                    <Textarea
                      name="speedReadings"
                      rows={8}
                      defaultValue={data.swings.map((swing) => swing.clubSpeedMph).join("\n")}
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
      </div>
    </PageShell>
  );
}

function MobileSpeedSessionAnswer({
  data,
  saved,
}: {
  data: SpeedSessionDetailPageData;
  saved: boolean;
}) {
  const sessionTitle = data.session.title ?? data.session.implementLabel;
  const targetGap =
    data.session.avgSpeedMph === null || data.session.targetSpeedMph === null
      ? null
      : data.session.targetSpeedMph - data.session.avgSpeedMph;

  return (
    <section
      data-mobile-speed-session-answer
      aria-labelledby="mobile-speed-session-title"
      className="min-w-0 overflow-hidden rounded-[1.15rem] border border-border bg-card"
    >
      <div className="px-5 pb-5 pt-6">
        <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          Speed session
        </p>
        <h1
          id="mobile-speed-session-title"
          className="mt-1 text-[28px] font-bold leading-8 tracking-tight text-foreground"
        >
          {sessionTitle}
        </h1>
        <div className="mt-1 flex min-w-0 items-start justify-between gap-3">
          <p className="min-w-0 text-[14px] leading-5 text-muted-foreground">
            {data.session.implementLabel} · {formatDate(data.session.sessionDateIso)}
          </p>
          <IOSInlineStatus
            label={data.swingSummary.trendLabel}
            tone={mobileSessionTrendTone(data.swingSummary.trendLabel)}
            className="max-w-[38%] flex-wrap justify-end text-right leading-4"
          />
        </div>

        {saved ? (
          <div
            role="status"
            className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-[13px] font-medium text-emerald-700 dark:text-emerald-300"
          >
            Speed session updated.
          </div>
        ) : null}

        <div className="mt-5 flex min-w-0 items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">Session average</p>
            <p className="mt-0.5 whitespace-nowrap text-[40px] font-bold leading-none tracking-tight text-foreground tabular-nums">
              {data.session.avgSpeedMph === null ? (
                <span className="text-[30px]">No data</span>
              ) : (
                <>
                  {data.session.avgSpeedMph.toFixed(1)}
                  <span className="ml-1 text-lg font-semibold text-muted-foreground">mph</span>
                </>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[13px] text-muted-foreground">Target gap</p>
            <p className="mt-0.5 text-[20px] font-semibold leading-6 text-foreground tabular-nums">
              {targetGap === null ? "Not set" : formatGap(targetGap)}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border px-5 py-5">
        <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          Next action
        </p>
        <h2 className="mt-1 text-[20px] font-semibold leading-6 text-foreground">
          {data.swings.length === 0 ? "Add the swing readings" : "Review the session evidence"}
        </h2>
        <p className="mt-1 text-[14px] leading-5 text-muted-foreground">
          {data.swings.length === 0
            ? "Individual readings unlock the warm-up, peak and finish pattern."
            : `${data.swings.length} swings are ready to scan without opening the desktop log.`}
        </p>
        <Button asChild className="mt-4 min-h-11 w-full rounded-xl" data-primary-action>
          <Link
            href={`/speed/sessions/${encodeURIComponent(data.session.id)}?edit=1#mobile-speed-session-details`}
            prefetch={false}
          >
            <Save className="size-4" aria-hidden="true" />
            {data.swings.length === 0 ? "Add readings" : "Edit session"}
          </Link>
        </Button>
      </div>

      <IOSGroupedList label="Speed session summary" className="rounded-none border-x-0 border-b-0">
        <IOSListRow
          label="Best swing"
          value={formatSpeed(data.swingSummary.bestSwingMph)}
          detail="Fastest measured swing in this session"
        />
        <IOSListRow
          label="Best three"
          value={formatSpeed(data.swingSummary.bestThreeAvgMph)}
          detail="Peak repeatable speed"
        />
        <IOSListRow
          label="Finish"
          value={formatSpeed(data.swingSummary.lastFiveAvgMph)}
          detail={`${formatGap(data.swingSummary.warmupGainMph)} from the opening five`}
        />
      </IOSGroupedList>
    </section>
  );
}

function MobileSpeedSessionDisclosures({
  data,
  openEditByDefault,
}: {
  data: SpeedSessionDetailPageData;
  openEditByDefault: boolean;
}) {
  return (
    <>
      <section id="mobile-speed-session-details" className="grid min-w-0 gap-2 scroll-mt-24">
        <IOSSectionHeader
          title="Session detail"
          description="Open one section for swing evidence or a focused edit."
        />
        <IOSDisclosureGroup
          key={openEditByDefault ? "edit-open" : "collapsed"}
          label="Speed session detail sections"
          defaultValue={openEditByDefault ? "edit-session" : undefined}
          items={[
            {
              value: "swing-evidence",
              title: "Swing evidence",
              summary: `${data.swings.length} swing${data.swings.length === 1 ? "" : "s"}`,
              description: "Phase, rolling speed and signal for every reading",
              content: <MobileSwingEvidence data={data} />,
              contentClassName: "px-3 pb-3 pt-3",
            },
            {
              value: "session-metadata",
              title: "Session details",
              summary: data.session.speedSystem ?? formatSwingSide(data.session.handedness),
              description: "Implement, source, target and notes",
              content: <MobileSpeedSessionMetadata data={data} />,
              contentClassName: "px-3 pb-3 pt-3",
            },
            {
              value: "edit-session",
              title: "Edit session",
              summary: "Readings & setup",
              description: "Correct the club, target, summary or individual swings",
              content: <MobileSpeedSessionEditForm data={data} />,
              contentClassName: "px-3 pb-3 pt-3",
            },
          ]}
        />
      </section>

      <section className="grid min-w-0 gap-2">
        <IOSSectionHeader
          title="Session management"
          description="Deletion is permanent and removes every swing reading."
        />
        <div className="ios-grouped-list p-4">
          <form action={deleteSpeedSessionAction}>
            <input type="hidden" name="sessionId" value={data.session.id} />
            <ConfirmSubmitButton
              confirmMessage={`Delete speed session ${data.session.title ?? data.session.implementLabel}? This removes the session and all swing readings.`}
              confirmTitle="Delete speed session?"
              confirmActionLabel="Delete session"
              variant="destructive"
              className="min-h-11 w-full rounded-xl"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete session
            </ConfirmSubmitButton>
          </form>
        </div>
      </section>
    </>
  );
}

function MobileSwingEvidence({ data }: { data: SpeedSessionDetailPageData }) {
  const bestSwing = data.swingSummary.bestSwingMph;
  const averageSwing = data.session.avgSpeedMph;

  if (data.swings.length === 0) {
    return (
      <IOSGroupedList label="Swing evidence empty state">
        <IOSListRow
          label="No individual swings"
          value="Summary only"
          detail="Paste the readings in Edit session to rebuild warm-up, peak and finish detail."
          status={<IOSInlineStatus label="More evidence needed" tone="attention" />}
        />
      </IOSGroupedList>
    );
  }

  return (
    <IOSGroupedList label="Individual speed swings">
      {data.swings.map((swing, index) => {
        const rollingThree = rollingAverage(
          data.swings
            .slice(Math.max(0, index - 2), index + 1)
            .map((reading) => reading.clubSpeedMph),
        );
        const phase = speedSwingPhase(index, data.swings.length, swing.clubSpeedMph, bestSwing);
        const signal = speedSwingSignal(swing.clubSpeedMph, bestSwing, averageSwing);

        return (
          <IOSListRow
            key={swing.id}
            label={`Swing ${swing.swingNumber}`}
            value={formatSpeedCompact(swing.clubSpeedMph)}
            detail={`${phase} · ${formatSwingSide(swing.swingSide)} · Rolling 3 ${formatSpeedCompact(rollingThree)}`}
            status={
              <IOSInlineStatus
                label={`${signal} · ${formatDelta(swing.clubSpeedMph, averageSwing)} vs average`}
                tone={signal === "Below average" ? "attention" : "positive"}
              />
            }
          />
        );
      })}
    </IOSGroupedList>
  );
}

function MobileSpeedSessionMetadata({ data }: { data: SpeedSessionDetailPageData }) {
  return (
    <IOSGroupedList label="Speed session metadata">
      <IOSListRow label="Date" value={formatDate(data.session.sessionDateIso)} />
      <IOSListRow label="Implement" value={data.session.implementLabel} />
      <IOSListRow label="Side" value={formatSwingSide(data.session.handedness)} />
      <IOSListRow label="Speed system" value={data.session.speedSystem ?? "Standard club speed"} />
      <IOSListRow label="Source" value={formatSwingSide(data.session.source)} />
      <IOSListRow label="Target" value={formatSpeed(data.session.targetSpeedMph)} />
      <IOSListRow
        label="Recorded range"
        value={`${formatSpeedCompact(data.session.minSpeedMph)}–${formatSpeedCompact(data.session.maxSpeedMph)}`}
        detail={`${data.session.swingCount} recorded swings`}
      />
      <IOSListRow label="Notes" detail={data.session.notes ?? "No notes added"} />
    </IOSGroupedList>
  );
}

function MobileSpeedSessionEditForm({ data }: { data: SpeedSessionDetailPageData }) {
  return (
    <form action={updateSpeedSessionAction} className="grid min-w-0 gap-4">
      <input type="hidden" name="sessionId" value={data.session.id} />
      <div className="grid gap-3">
        <Field label="Date">
          <Input
            name="sessionDate"
            type="date"
            defaultValue={dateInputValue(data.session.sessionDateIso)}
            className="h-11 bg-background"
          />
        </Field>
        <Field label="Title">
          <Input
            name="title"
            defaultValue={data.session.title ?? ""}
            className="h-11 bg-background"
          />
        </Field>
        <Field label="Club used">
          <NativeSelect
            name="clubId"
            defaultValue={data.session.clubId ?? ""}
            className="h-11 bg-background px-3 text-base"
          >
            <option value="">Not in bag / speed stick</option>
            {data.clubOptions.map((club) => (
              <option key={club.id} value={club.id}>
                {club.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Implement">
            <NativeSelect
              name="implementKind"
              defaultValue={data.session.implementKind}
              className="h-11 bg-background px-3 text-base"
            >
              <option value="club">Golf club</option>
              <option value="speed_stick">Speed stick</option>
              <option value="weighted_club">Weighted club</option>
              <option value="other">Other</option>
            </NativeSelect>
          </Field>
          <Field label="Side">
            <NativeSelect
              name="handedness"
              defaultValue={data.session.handedness}
              className="h-11 bg-background px-3 text-base"
            >
              <option value="dominant">Dominant</option>
              <option value="non_dominant">Non-dominant</option>
              <option value="both">Both sides</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Speed system">
          <NativeSelect
            name="speedSystem"
            defaultValue={data.session.speedSystem ?? ""}
            className="h-11 bg-background px-3 text-base"
          >
            <option value="">Standard club speed</option>
            <option value="R-Speed">R-Speed</option>
            <option value="Light speed stick">Light speed stick</option>
            <option value="Medium speed stick">Medium speed stick</option>
            <option value="Heavy speed stick">Heavy speed stick</option>
            <option value="Stack">Stack</option>
            <option value="Other">Other</option>
          </NativeSelect>
        </Field>
        <Field label="Implement label">
          <Input
            name="implementLabel"
            defaultValue={data.session.implementLabel}
            className="h-11 bg-background"
          />
        </Field>
      </div>

      <Field label="Swing speeds">
        <Textarea
          name="speedReadings"
          rows={8}
          inputMode="decimal"
          defaultValue={data.swings.map((swing) => swing.clubSpeedMph).join("\n")}
          className="min-h-40 bg-background text-base"
        />
        <span className="text-[12px] leading-5 text-muted-foreground">
          One speed per line is easiest to review. Spaces and commas also work.
        </span>
      </Field>

      <div className="grid gap-3 border-t border-border pt-4">
        <IOSSectionHeader
          title="Session summary"
          description="These values are used when individual readings are unavailable."
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum">
            <Input
              name="minSpeedMph"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={numberInputValue(data.session.minSpeedMph)}
              className="h-11 bg-background"
            />
          </Field>
          <Field label="Average">
            <Input
              name="avgSpeedMph"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={numberInputValue(data.session.avgSpeedMph)}
              className="h-11 bg-background"
            />
          </Field>
          <Field label="Maximum">
            <Input
              name="maxSpeedMph"
              type="number"
              inputMode="decimal"
              step="0.1"
              defaultValue={numberInputValue(data.session.maxSpeedMph)}
              className="h-11 bg-background"
            />
          </Field>
          <Field label="Swing count">
            <Input
              name="swingCount"
              type="number"
              inputMode="numeric"
              min="1"
              defaultValue={String(data.session.swingCount)}
              className="h-11 bg-background"
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-3 border-t border-border pt-4">
        <Field label="Target speed">
          <Input
            name="targetSpeedMph"
            type="number"
            inputMode="decimal"
            step="0.1"
            defaultValue={numberInputValue(data.session.targetSpeedMph)}
            className="h-11 bg-background"
          />
        </Field>
        <Field label="Notes">
          <Textarea
            name="notes"
            rows={3}
            defaultValue={data.session.notes ?? ""}
            className="min-h-24 bg-background text-base"
          />
        </Field>
      </div>

      <Button type="submit" className="min-h-11 w-full rounded-xl">
        <Save className="size-4" aria-hidden="true" />
        Save changes
      </Button>
    </form>
  );
}

function mobileSessionTrendTone(value: string): ComponentProps<typeof IOSInlineStatus>["tone"] {
  const normalized = value.toLowerCase();

  if (
    normalized.includes("strong") ||
    normalized.includes("gain") ||
    normalized.includes("built")
  ) {
    return "positive";
  }
  if (normalized.includes("drop") || normalized.includes("fade")) return "attention";
  return "info";
}

function SwingLogWorkbench({ data }: { data: SpeedSessionDetailPageData }) {
  const bestSwing = data.swingSummary.bestSwingMph;
  const averageSwing = data.session.avgSpeedMph;

  return (
    <section
      id="speed-session-swing-log"
      className="hidden gap-3 sm:grid"
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
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="swing"
                className="sticky left-0 z-20 min-w-24 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
              const phase = speedSwingPhase(
                index,
                data.swings.length,
                swing.clubSpeedMph,
                bestSwing,
              );
              const signal = speedSwingSignal(swing.clubSpeedMph, bestSwing, averageSwing);

              return (
                <TableRow key={swing.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="swing"
                    className="sticky left-0 z-10 min-w-24 bg-white font-semibold shadow-[1px_0_0_rgba(15,23,42,0.08)]"
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
    <div className="rounded-lg border border-border/70 bg-white/65 p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-950">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Date unknown";
  }

  return dateFormatter.format(new Date(value));
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
