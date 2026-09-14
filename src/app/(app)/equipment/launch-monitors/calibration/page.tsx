import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Radar, ShieldCheck } from "lucide-react";
import { getDb } from "@/db/client";
import { sessions, shots } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/current-user";
import { formatClubType } from "@/lib/club-format";
import {
  PageShell,
  PageHeader,
  DataPanel as PremiumDataPanel,
  StatusPill,
} from "@/components/premium";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  calibrationCandidates,
  calibrationMetrics,
  medianMetric,
  monitorConditions,
  sourceNormalisation,
  type MonitorConditions,
} from "@/lib/launch-monitor-calibration";
import { saveMonitorConditions } from "@/app/equipment/calibration/actions";

export const dynamic = "force-dynamic";
function DataPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <PremiumDataPanel className="min-w-0 w-full">
      <div className="min-w-0 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mb-5 mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {children}
      </div>
    </PremiumDataPanel>
  );
}
const path = "/equipment/launch-monitors/calibration";
const reviewLabel = (status: string) => status.replaceAll("_", " ");
const label = (source: string) =>
  ({ rapsodo: "Rapsodo MLM2PRO", trackman: "TrackMan", toptracer: "Toptracer", manual: "Manual" })[
    source
  ] ?? source;
const number = (value: number | null) =>
  value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
const date = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(value);
const selectClass =
  "mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm";

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; reference?: string; club?: string; saved?: string }>;
}) {
  const userId = await requireCurrentUserId();
  const query = await searchParams;
  const db = getDb();
  const available = await db
    .select({
      id: sessions.id,
      source: sessions.source,
      date: sessions.date,
      fileName: sessions.fileName,
      dataConfidenceJson: sessions.dataConfidenceJson,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        inArray(sessions.source, ["rapsodo", "trackman", "toptracer", "manual"]),
      ),
    )
    .orderBy(desc(sessions.date))
    .limit(100);
  const source = query.source
    ? available.find((s) => s.id === query.source)
    : (available.find((s) => s.source === "rapsodo") ?? available[0]);
  const reference = query.reference
    ? available.find((s) => s.id === query.reference)
    : available.find((s) => s.source === "trackman" && s.id !== source?.id);
  if ((query.source && !source) || (query.reference && !reference)) notFound();
  const selectedIds = [...new Set([source?.id, reference?.id].filter((id): id is string => !!id))];
  const evidence = selectedIds.length
    ? await db
        .select({
          id: shots.id,
          sessionId: shots.sessionId,
          shotNumber: shots.shotNumber,
          clubType: shots.clubType,
          reviewStatus: shots.reviewStatus,
          carryYd: shots.carryYd,
          totalYd: shots.totalYd,
          ballSpeedMph: shots.ballSpeedMph,
          clubSpeedMph: shots.clubSpeedMph,
          launchAngleDeg: shots.launchAngleDeg,
          spinRate: shots.spinRate,
          sideCarryYd: shots.sideCarryYd,
          sourceRawJson: shots.sourceRawJson,
        })
        .from(shots)
        .where(and(eq(shots.userId, userId), inArray(shots.sessionId, selectedIds)))
        .orderBy(asc(shots.shotNumber))
    : [];
  const clubs = [...new Set(evidence.map((s) => s.clubType))];
  const club =
    query.club && clubs.includes(query.club)
      ? query.club
      : clubs.includes("driver")
        ? "driver"
        : clubs[0];
  const sourceShots = evidence.filter((s) => s.sessionId === source?.id && s.clubType === club);
  const referenceShots = evidence.filter(
    (s) => s.sessionId === reference?.id && s.clubType === club,
  );
  const paired = source && reference && source.id !== reference.id;
  const candidates = paired ? calibrationCandidates(sourceShots, referenceShots) : [];
  const normalisation = sourceNormalisation(referenceShots);
  const sourceConditions = monitorConditions(
    (source?.dataConfidenceJson as Record<string, unknown> | undefined)?.launchMonitor,
  );
  const referenceConditions = monitorConditions(
    (reference?.dataConfidenceJson as Record<string, unknown> | undefined)?.launchMonitor,
  );
  return (
    <PageShell>
      <Link
        href="/equipment"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        Equipment
      </Link>
      <PageHeader
        eyebrow={<StatusPill tone="sky">Launch monitors</StatusPill>}
        title="Calibration"
        description="Know where your numbers come from. Compare devices, check the conditions and keep every original reading."
        actions={
          <Button asChild variant="outline">
            <Link href="/import">
              Import a session
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-7 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Radar className="size-5" />
            Your accuracy lab
          </div>
          <h2 className="text-2xl font-semibold">Raw readings. Clearer confidence.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Carry depends on flight modelling and session settings. Use a reference device to
            understand the difference, then calibrate from confirmed matching shots.
          </p>
          {sourceConditions.recording === "partial" ? (
            <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
              Partial recording: {label(source?.source ?? "Source")} stopped partway through. Some
              reference shots will have no counterpart.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/40 p-5">
          <div>
            <p className="text-xs text-muted-foreground">Calibration status</p>
            <p className="mt-2 font-semibold">Awaiting matched shots</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Applied correction</p>
            <p className="mt-2 font-semibold">None</p>
          </div>
          <p className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            Original measurements are preserved.
          </p>
        </div>
      </section>
      <DataPanel
        title="Compare your sessions"
        description="Select the recordings and a club. Recent 100 sessions shown; session averages are context, not calibration bias."
      >
        <form
          action={path}
          className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_auto] lg:items-end"
        >
          <label className="text-sm font-medium">
            Source device
            <select name="source" defaultValue={source?.id ?? ""} className={selectClass} required>
              <option value="" disabled>
                Choose a session
              </option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {label(s.source)} · {date(s.date)} · {s.fileName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Reference device
            <select
              name="reference"
              defaultValue={reference?.id ?? ""}
              className={selectClass}
              required
            >
              <option value="" disabled>
                Choose a session
              </option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {label(s.source)} · {date(s.date)} · {s.fileName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Club
            <select name="club" defaultValue={club ?? ""} className={selectClass}>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {formatClubType(c)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={available.length < 2}>
            Compare
          </Button>
        </form>
      </DataPanel>
      {!paired ? (
        <DataPanel
          title="Choose two different sessions"
          description="Import recordings from both devices, then select them above. Your existing shots will stay untouched."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: label(source.source), value: sourceShots.length, detail: "source shots" },
              {
                title: label(reference.source),
                value: referenceShots.length,
                detail: "reference shots",
              },
              { title: "Confirmed matches", value: 0, detail: "Calibration remains pending" },
            ].map((item, index) => (
              <div key={index} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{item.title}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatClubType(club ?? "unknown")} · {item.detail}
                </p>
              </div>
            ))}
          </div>
          <DataPanel
            title="Metric confidence"
            description="Raw medians of all saved shots for this club, including excluded shots for inspection. No device bias has been established."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <caption className="sr-only">Raw device metrics and calibration confidence</caption>
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    {[
                      "Metric",
                      label(source.source),
                      label(reference.source),
                      "Evidence",
                      "Calibration",
                    ].map((header, i) => (
                      <th key={i} className="px-3 py-3 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calibrationMetrics.map((metric) => {
                    const a = medianMetric(sourceShots, metric.key),
                      b = medianMetric(referenceShots, metric.key);
                    return (
                      <tr key={metric.key} className="border-b border-border/60 last:border-0">
                        <th className="px-3 py-4 font-medium">
                          {metric.label}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {metric.unit}
                          </span>
                        </th>
                        <td className="px-3 py-4 tabular-nums">
                          {number(a.value)}
                          <span className="block text-xs text-muted-foreground">
                            {a.count} readings
                          </span>
                        </td>
                        <td className="px-3 py-4 tabular-nums">
                          {number(b.value)}
                          <span className="block text-xs text-muted-foreground">
                            {b.count} readings
                          </span>
                        </td>
                        <td className="px-3 py-4 text-muted-foreground">{metric.kind}</td>
                        <td className="px-3 py-4">
                          {metric.key === "totalYd"
                            ? "Do not cross-compare"
                            : metric.key === "spinRate" &&
                                source.source === "rapsodo" &&
                                sourceConditions.ballType !== "rpt"
                              ? "Verify RPT ball usage"
                              : "Pending matched evidence"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Reference source settings: {normalisation.on} normalised on · {normalisation.off} off
              · {normalisation.unknown} unknown. A saved session setting below adds context; it
              never replaces original per-shot settings.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Device guidance:{" "}
              <a
                className="underline"
                href="https://rapsodo.com/pages/frequently-asked-golf-questions-faq"
                target="_blank"
                rel="noreferrer"
              >
                Rapsodo spin and RPT balls
              </a>{" "}
              ·{" "}
              <a
                className="underline"
                href="https://www.trackman.com/blog/normalization-feature-explained"
                target="_blank"
                rel="noreferrer"
              >
                TrackMan normalisation
              </a>
              .
            </p>
          </DataPanel>
          <DataPanel
            title="Your carry, explained"
            description="Three different numbers, with different jobs."
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Carry
                label="Raw carry"
                value={`${number(medianMetric(sourceShots, "carryYd").value)}${sourceShots.some((s) => s.carryYd !== null) ? " yd" : ""}`}
                detail="Median imported carry for this club."
              />
              <Carry
                label="LMWT calibrated carry"
                value="Pending"
                detail="Needs confirmed pairs and comparable conditions."
              />
              <Carry
                label="Course plays-like carry"
                value="Not estimated"
                detail="Requires course and weather context."
              />
            </div>
          </DataPanel>
          <DataPanel
            title="Session conditions"
            description="Record what you know. Unknown is a valid answer, and partial recordings do not need to match every reference shot."
          >
            {query.saved === "1" ? (
              <p role="status" className="mb-4 text-sm text-primary">
                Session conditions saved.
              </p>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-2">
              {[
                { session: source, conditions: sourceConditions },
                { session: reference, conditions: referenceConditions },
              ].map(({ session, conditions }) => (
                <form
                  key={`${session.id}:${JSON.stringify(conditions)}`}
                  action={saveMonitorConditions}
                  className="rounded-xl border border-border p-4"
                >
                  <h3 className="font-semibold">{label(session.source)}</h3>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {date(session.date)} · {session.fileName}
                  </p>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <input type="hidden" name="sourceId" value={source.id} />
                  <input type="hidden" name="referenceId" value={reference.id} />
                  <input type="hidden" name="club" value={club} />
                  <div className="my-4 grid gap-4 sm:grid-cols-2">
                    <Condition
                      name="environment"
                      title="Environment"
                      value={conditions.environment}
                      options={[
                        ["indoor", "Indoor"],
                        ["outdoor", "Outdoor"],
                      ]}
                    />
                    <Condition
                      name="ballType"
                      title="Ball"
                      value={conditions.ballType}
                      options={[
                        ["range", "Range"],
                        ["premium", "Premium"],
                        ["rpt", "RPT"],
                      ]}
                    />
                    <Condition
                      name="normalised"
                      title="Normalisation"
                      value={conditions.normalised}
                      options={[
                        ["on", "On"],
                        ["off", "Off"],
                      ]}
                    />
                    <Condition
                      name="ballConversion"
                      title="Ball conversion"
                      value={conditions.ballConversion}
                      options={[
                        ["on", "On"],
                        ["off", "Off"],
                      ]}
                    />
                    <Condition
                      name="recording"
                      title="Recording coverage"
                      value={conditions.recording}
                      options={[
                        ["complete", "Full recording"],
                        ["partial", "Stopped partway through"],
                      ]}
                    />
                  </div>
                  <Button type="submit" variant="outline">
                    Save {label(session.source)} conditions
                  </Button>
                </form>
              ))}
            </div>
          </DataPanel>
          <DataPanel
            title="Possible matching shots"
            description="Club and similar speed/launch suggest candidates, not confirmed matches. No correction is applied. Missing recordings are expected when a device stops."
          >
            <p className="mb-4 text-sm text-muted-foreground">
              Exploration only: within 3 mph ball speed, 2° launch and 3 mph club speed. Carry and
              spin are not used to pick a match. Candidates can compete for the same reference shot.
            </p>
            <div className="space-y-3">
              {candidates.length ? (
                candidates.map(({ shot, candidates: matches }) => (
                  <details key={shot.id} className="rounded-xl border border-border p-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      Shot {shot.shotNumber ?? "—"} · {number(shot.carryYd)} yd raw carry{" "}
                      <span className="ml-2 text-muted-foreground">
                        {matches.length
                          ? `${matches.length} possible ${matches.length === 1 ? "match" : "matches"}`
                          : "No close candidate"}{" "}
                        · {reviewLabel(shot.reviewStatus)}
                      </span>
                    </summary>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Source: {number(shot.ballSpeedMph)} mph ball · {number(shot.clubSpeedMph)} mph
                      club · {number(shot.launchAngleDeg)}° launch
                    </p>
                    {matches.map((other) => (
                      <div key={other.id} className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                        Reference shot {other.shotNumber ?? "—"}
                        {other.sourceRawJson.group_id ? ` · ${other.sourceRawJson.group_id}` : ""}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {number(other.ballSpeedMph)} mph ball · {number(other.clubSpeedMph)} mph
                          club · {number(other.launchAngleDeg)}° launch · {number(other.carryYd)} yd
                          raw carry · {reviewLabel(other.reviewStatus)}
                        </p>
                        <p className="mt-1 text-xs">Unverified — not used for calibration</p>
                      </div>
                    ))}
                  </details>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No source shots for this club. Choose another club above.
                </p>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href={`/sessions/${source.id}`}>Inspect source shots</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/sessions/${reference.id}`}>Inspect reference shots</Link>
              </Button>
            </div>
          </DataPanel>
        </>
      )}
    </PageShell>
  );
}
function Carry({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="my-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
function Condition({
  name,
  title,
  value,
  options,
}: {
  name: keyof MonitorConditions;
  title: string;
  value: string;
  options: string[][];
}) {
  return (
    <label className="text-sm">
      {title}
      <select name={name} defaultValue={value} className={selectClass}>
        <option value="unknown">Unknown</option>
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
