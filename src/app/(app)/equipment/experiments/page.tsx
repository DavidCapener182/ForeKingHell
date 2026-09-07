import { ExperimentSelection } from "@/app/equipment/experiments/experiment-selection";
import { EquipmentInlineForm } from "@/app/equipment/equipment-form-panels";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { saveSessionComparisonWithStateAction } from "@/app/analyse/compare/actions";
import { PageHeader, PageShell, StatusPill } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/db/client";
import { analysisSnapshots } from "@/db/schema";
import { buildComparisonProvenance } from "@/lib/comparison-provenance";
import {
  defaultCompareFilters,
  getCompareData,
  type CompareConditionMode,
} from "@/lib/compare-data";
import { requireCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function EquipmentExperimentPage({
  searchParams,
}: {
  searchParams?: Promise<{
    sessionId?: string;
    baselineSessionId?: string;
    clubId?: string;
    snapshotId?: string;
  }>;
}) {
  const params = await searchParams;
  const userId = await requireCurrentUserId();
  const saved = await getDb()
    .select()
    .from(analysisSnapshots)
    .where(
      and(
        eq(analysisSnapshots.userId, userId),
        sql`${analysisSnapshots.chartStateJson}->>'view' = 'session_comparison'`,
        sql`${analysisSnapshots.chartStateJson}->>'experimentType' in ('equipment_change','ball_change','club_setting')`,
      ),
    )
    .orderBy(desc(analysisSnapshots.capturedAt));
  const snapshot = params?.snapshotId
    ? saved.find((row) => row.id === params.snapshotId)
    : undefined;
  if (params?.snapshotId && !snapshot)
    return (
      <PageShell>
        <PageHeader
          title="Saved decision unavailable"
          description="This decision is unavailable for this account."
        />
        <Button asChild>
          <Link href="/equipment/experiments">Start a new comparison</Link>
        </Button>
      </PageShell>
    );
  const savedFilters = snapshot?.filtersJson;
  const savedCondition = textValue(savedFilters?.condition);
  const condition: CompareConditionMode =
    savedCondition === "indoor-outdoor" || savedCondition === "practice-round"
      ? savedCondition
      : "same";
  const supportedSnapshot =
    !savedFilters ||
    ((!savedFilters.focus || savedFilters.focus === "session") &&
      (!savedFilters.baseline || savedFilters.baseline === "previous-session"));
  const filters = {
    ...defaultCompareFilters(),
    condition,
    focus: "session" as const,
    baseline: "previous-session" as const,
    sessionId: normalizeOptionalQuery(
      savedFilters ? textValue(savedFilters.sessionId) : params?.sessionId,
    ),
    baselineSessionId: normalizeOptionalQuery(
      savedFilters ? textValue(savedFilters.baselineSessionId) : params?.baselineSessionId,
    ),
    clubId: normalizeOptionalQuery(savedFilters ? textValue(savedFilters.clubId) : params?.clubId),
  };
  const data = await getCompareData(filters);
  const explicit = Boolean(
    supportedSnapshot &&
    filters.sessionId &&
    filters.baselineSessionId &&
    filters.sessionId !== filters.baselineSessionId &&
    data.sessions.some((row) => row.id === filters.sessionId) &&
    data.sessions.some((row) => row.id === filters.baselineSessionId),
  );
  const metrics = buildComparisonProvenance(data);
  return (
    <PageShell>
      <div className="grid gap-4" data-equipment-experiment-desktop>
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/equipment">
            <ArrowLeft className="size-4" aria-hidden />
            Equipment
          </Link>
        </Button>
        <PageHeader
          eyebrow={<StatusPill tone="sky">Controlled testing</StatusPill>}
          title="Equipment Experiment Lab"
          description="Define what changed, keep the test conditions explicit, compare measured outcomes and save the equipment decision with its confidence."
        />
        {snapshot ? (
          <details open className="rounded-xl border bg-card p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">
              Saved decision: {snapshot.name}
            </summary>
            <p className="whitespace-pre-wrap text-sm">{snapshot.notes || "No notes"}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Saved {snapshot.capturedAt.toLocaleString("en-GB")}. The comparison below re-reads the
              original session IDs; later reviews may change the live calculation.
            </p>
            <dl className="mt-3 grid gap-2">
              {[
                ["Test setup", snapshot.summaryJson.focusLabel],
                ["Baseline", snapshot.summaryJson.baselineLabel],
                ["Test sample", snapshot.summaryJson.focusShots],
                ["Baseline sample", snapshot.summaryJson.baselineShots],
                ["Saved interpretation", snapshot.summaryJson.verdict],
                ["Saved summary", snapshot.summaryJson.summary],
              ].map(([label, value]) => (
                <div key={String(label)} className="grid grid-cols-2 gap-2 text-sm">
                  <dt>{String(label)}</dt>
                  <dd>
                    {typeof value === "string" || typeof value === "number"
                      ? String(value)
                      : "Not recorded"}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
        <ExperimentSelection
          key={`${filters.sessionId}:${filters.baselineSessionId}:${filters.clubId}`}
          sessions={data.sessions}
          clubs={data.clubs}
          initialTest={filters.sessionId}
          initialBaseline={filters.baselineSessionId}
          initialClub={filters.clubId}
        />
        {!explicit ? (
          <Alert>
            <AlertTitle>Choose two different saved sessions</AlertTitle>
            <AlertDescription>
              No automatic or latest-session substitution is used for an equipment decision.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <FairTestWarning />
            <details className="rounded-xl border p-3">
              <summary className="min-h-11 cursor-pointer font-semibold">
                Comparability details
              </summary>
              <p className="text-sm">
                Condition scope: {data.filters.condition}. Session selection alone does not confirm
                matched weather, ball, target or warm-up.
              </p>
              <ul className="list-disc pl-5 text-sm">
                {data.benefit.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
            <p className="text-sm text-muted-foreground">
              Baseline: {data.baseline.label} · {data.baseline.stockShots} qualifying shots ·{" "}
              {data.baseline.detail}. Test: {data.focus.label} · {data.focus.stockShots} qualifying
              shots · {data.focus.detail}.
            </p>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <article key={metric.key} className="rounded-2xl border bg-card p-4">
                  <p className="text-sm font-semibold">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{formatMetric(metric)}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {metric.confidenceLabel} · {metric.caveat}
                  </p>
                </article>
              ))}
            </section>
          </>
        )}
        <section className="grid gap-4 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {explicit ? (
            <ExperimentDecisionForm
              key={`${filters.sessionId}:${filters.baselineSessionId}:${filters.clubId}`}
              data={data}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Select and compare both setups before recording a decision.
            </p>
          )}
          <aside>
            <h2 className="text-xl font-semibold">Saved decisions</h2>
            <div className="mt-3 grid gap-2">
              {saved.length ? (
                saved.map((snapshot) => (
                  <div key={snapshot.id} className="rounded-xl bg-secondary/55 p-3">
                    <p className="font-semibold">{snapshot.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Saved {snapshot.capturedAt.toLocaleDateString("en-GB")} · Confidence:{" "}
                      {textValue(snapshot.chartStateJson.confidence) || "not recorded"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {snapshot.notes ?? "No decision note"}
                    </p>
                    <Link
                      className="mt-2 flex min-h-11 items-center text-primary"
                      href={`/equipment/experiments?snapshotId=${snapshot.id}`}
                    >
                      Reopen saved evidence
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No equipment decision saved yet.</p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </PageShell>
  );
}

function ExperimentDecisionForm({ data }: { data: Awaited<ReturnType<typeof getCompareData>> }) {
  return (
    <EquipmentInlineForm action={saveSessionComparisonWithStateAction} submitLabel="Save decision">
      <h2 className="text-lg font-semibold">Record a new decision</h2>
      <p className="text-sm text-muted-foreground">
        This saves the selected evidence and your notes. Existing decisions remain unchanged.
      </p>
      <input type="hidden" name="sessionId" value={data.filters.sessionId} />
      <input type="hidden" name="baselineSessionId" value={data.filters.baselineSessionId} />
      <input type="hidden" name="clubId" value={data.filters.clubId} />
      <input type="hidden" name="condition" value={data.filters.condition} />
      <label className="grid gap-1 text-sm font-semibold">
        Decision name
        <Input
          name="name"
          placeholder="New driver versus current driver"
          className="min-h-11 text-base"
          required
        />
      </label>
      <UntitledSelect
        label="Experiment type"
        name="experimentType"
        defaultValue="equipment_change"
        options={[
          { value: "equipment_change", label: "Club change" },
          { value: "ball_change", label: "Golf ball" },
          { value: "club_setting", label: "Club setting" },
        ]}
      />
      <UntitledSelect
        label="Your decision confidence"
        name="confidence"
        defaultValue="uncertain"
        description="Your recorded judgement, separate from calculated sample confidence."
        options={[
          { value: "uncertain", label: "Uncertain — retest" },
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ]}
      />
      <Field name="ball" label="Keep constant: ball" placeholder="Pro V1" />
      <Field name="location" label="Keep constant: location" placeholder="Bay 4" />
      <Field name="target" label="Keep constant: target" placeholder="250 yd centre line" />
      <Field name="warmup" label="Keep constant: warm-up" placeholder="10 shots" />
      <Field name="loft" label="Loft / setting" placeholder="10.5° neutral" />
      <Field name="shaft" label="Shaft" placeholder="Model and flex" />
      <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
        Notes and saved equipment decision
        <Textarea
          name="notes"
          rows={4}
          maxLength={4000}
          className="min-h-28 rounded-xl border bg-background p-3 text-base"
          placeholder="Decision, caveats, and what must be retested"
          required
        />
      </label>
    </EquipmentInlineForm>
  );
}

function FairTestWarning() {
  return (
    <Alert className="border-[var(--status-warning-border)] bg-[var(--status-warning-surface)] text-[var(--status-warning-foreground)]">
      <ShieldAlert className="size-4" aria-hidden />
      <AlertTitle>Check whether the test is fair</AlertTitle>
      <AlertDescription>
        These samples came from separate sessions. If ball, location, target, warm-up or conditions
        changed, lower the confidence and record it in the decision.
      </AlertDescription>
    </Alert>
  );
}

function formatMetric(metric: ReturnType<typeof buildComparisonProvenance>[number]) {
  if (metric.value === null) return "—";
  const value = Math.round(metric.value * 10) / 10;
  return `${value > 0 ? "+" : ""}${value} ${metric.unit}`;
}

function normalizeOptionalQuery(value: string | undefined) {
  return value && value !== "__auto__" && value !== "__all__" && value !== "__choose__"
    ? value
    : "";
}
function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <Input name={name} placeholder={placeholder} maxLength={180} className="min-h-11 text-base" />
    </label>
  );
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
