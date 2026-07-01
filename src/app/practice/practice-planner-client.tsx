"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Save,
  SlidersHorizontal,
  Target,
  Upload,
  WandSparkles,
} from "lucide-react";

import {
  abandonPracticePlanAction,
  generatePracticePlanAction,
  linkPracticePlanSessionAction,
  savePracticePlanAction,
  startPracticePlanAction,
} from "@/app/practice/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type {
  GeneratePracticePlanOptions,
  PracticeBlock,
  PracticeComparison,
  PracticeEnergyLevel,
  PracticeFacilityOptions,
  PracticeIntent,
  PracticeImportOption,
  PracticeLatestSessionReview,
  PracticePlan,
  PracticePlannerContext,
  PracticeScore,
  PracticeSessionType,
  PracticeTemplateView,
  SavedPracticePlan,
} from "@/lib/practice-planner";
import {
  buildPracticeFocusSummary,
  compactPracticeBlockRow,
  defaultSelectedPracticeBlockId,
  scoredFromLabel,
  summarizePracticeImportControl,
  type PracticeBlockImportStatus,
} from "@/lib/practice-planner-view";
import { cn } from "@/lib/utils";

type PracticePlannerClientProps = {
  context: PracticePlannerContext;
  initialPlan: PracticePlan;
  savedPlans: SavedPracticePlan[];
  templates: PracticeTemplateView[];
  importOptions: PracticeImportOption[];
  latestSessionReview: PracticeLatestSessionReview | null;
};

const sessionTypes: Array<{ value: PracticeSessionType; label: string }> = [
  { value: "range", label: "Range" },
  { value: "short_game", label: "Short game" },
  { value: "speed", label: "Speed" },
  { value: "putting", label: "Putting" },
  { value: "course_warmup", label: "Warm-up" },
  { value: "mixed", label: "Mixed" },
];

const ballCounts = [30, 50, 80, 100, 120];
const timeOptions = [20, 30, 45, 60, 90];
const energyOptions: Array<{ value: PracticeEnergyLevel; label: string }> = [
  { value: "fresh", label: "Fresh" },
  { value: "normal", label: "Normal" },
  { value: "tired", label: "Tired" },
  { value: "niggle", label: "Niggle" },
];
const intentOptions: Array<{ value: PracticeIntent; label: string }> = [
  { value: "scoring", label: "Scoring" },
  { value: "confidence", label: "Confidence" },
  { value: "latest_weakness", label: "Latest weakness" },
  { value: "round_preparation", label: "Round prep" },
  { value: "distance_mapping", label: "Distance mapping" },
  { value: "speed", label: "Speed" },
];

export function PracticePlannerClient({
  context,
  initialPlan,
  savedPlans,
  templates,
  importOptions,
  latestSessionReview,
}: PracticePlannerClientProps) {
  const [options, setOptions] = useState<GeneratePracticePlanOptions>({
    sessionType: "range",
    ballCount: 80,
    timeMinutes: 45,
    energy: "normal",
    intent: "latest_weakness",
    facility: {
      chippingGreen: true,
      bunker: true,
      puttingGreen: true,
      distanceAvailableFt: 30,
      speedSticks: false,
      golfClubOnly: true,
      rapsodoSpeed: true,
      overrideTrainingLoad: false,
    },
  });
  const [plan, setPlan] = useState(initialPlan);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() =>
    defaultSelectedPracticeBlockId(initialPlan.blocks),
  );
  const [savedPlanId, setSavedPlanId] = useState<string | null>(initialPlan.id ?? null);
  const [selectedImportId, setSelectedImportId] = useState(
    latestSessionReview?.sourceSessionId ?? importOptions[0]?.id ?? "",
  );
  const [localSavedPlans] = useState(savedPlans);
  const initialSavedPlan = initialPlan.id
    ? savedPlans.find((savedPlan) => savedPlan.id === initialPlan.id) ?? null
    : null;
  const [comparison, setComparison] = useState<PracticeComparison | null>(
    initialSavedPlan?.result?.comparison ?? latestSessionReview?.comparison ?? null,
  );
  const [practiceScore, setPracticeScore] = useState<PracticeScore | null>(
    initialSavedPlan?.result ? scoreFromSavedPlan(initialSavedPlan) : latestSessionReview?.score ?? null,
  );
  const [message, setMessage] = useState<string | null>(
    latestSessionReview && !initialSavedPlan?.result
      ? `Latest ${latestSessionReview.importedSession.shotCount}-shot session is being used to review this plan. Incomplete planned clubs still count, but they pull the score down.`
      : null,
  );
  const [isPending, startTransition] = useTransition();
  const sessionSummary = useMemo(
    () => summarizePracticeImportControl(plan, comparison),
    [plan, comparison],
  );
  const focusSummary = useMemo(() => buildPracticeFocusSummary(plan), [plan]);
  const selectedBlock = useMemo(
    () => plan.blocks.find((block) => block.id === selectedBlockId) ?? plan.blocks[0] ?? null,
    [plan.blocks, selectedBlockId],
  );

  function updateOptions(patch: Partial<GeneratePracticePlanOptions>) {
    setOptions((current) => ({ ...current, ...patch }));
  }

  function updateFacility(patch: Partial<PracticeFacilityOptions>) {
    setOptions((current) => ({
      ...current,
      facility: { ...current.facility, ...patch },
    }));
  }

  function generatePlan(nextOptions = options) {
    setMessage(null);
    startTransition(async () => {
      const generated = await generatePracticePlanAction(nextOptions);
      setPlan(generated);
      setSelectedBlockId(defaultSelectedPracticeBlockId(generated.blocks));
      setSavedPlanId(null);
      setComparison(null);
      setPracticeScore(null);
    });
  }

  function savePlan() {
    setMessage(null);
    startTransition(async () => {
      const result = await savePracticePlanAction(plan);
      setSavedPlanId(result.planId);
      setPlan((current) => ({ ...current, id: result.planId, status: "planned" }));
      setComparison(null);
      setPracticeScore(null);
      setMessage("Plan saved. It is waiting for the next uploaded range session; older uploads will not score this practice.");
    });
  }

  function linkSelectedSession() {
    if (!selectedImportId) {
      setMessage("Choose an uploaded session first.");
      return;
    }

    if (!savedPlanId) {
      setMessage("Save this practice plan before importing a session into it.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await linkPracticePlanSessionAction(savedPlanId, selectedImportId);

      if (!result.latestSessionReview) {
        setMessage(result.error ?? "That uploaded session could not be scored against this plan.");
        return;
      }

      setComparison(result.latestSessionReview.comparison);
      setPracticeScore(result.latestSessionReview.score);
      setPlan((current) => ({
        ...current,
        status: "analysed",
      }));
      setMessage(
        `Selected ${result.latestSessionReview.importedSession.shotCount}-shot session is now scoring this practice. Incomplete planned clubs still pull the score down.`,
      );
    });
  }

  function startPractice() {
    if (!savedPlanId) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      await startPracticePlanAction(savedPlanId);
      setPlan((current) => ({ ...current, status: "awaiting_import" }));
      setMessage("Practice started. Upload or sync the matching launch-monitor session when finished.");
    });
  }

  function abandonPlan() {
    if (!savedPlanId) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      await abandonPracticePlanAction(savedPlanId);
      setPlan((current) => ({ ...current, status: "abandoned" }));
      setMessage("Plan abandoned. Generate a new plan when you are ready.");
    });
  }

  function useTemplate(template: PracticeTemplateView) {
    const nextOptions: GeneratePracticePlanOptions = {
      sessionType: template.sessionType,
      ballCount: template.ballCount,
      timeMinutes: template.timeMinutes,
      energy: options.energy,
      intent: template.intent,
      facility: options.facility,
    };
    setOptions(nextOptions);
    generatePlan(nextOptions);
  }

  function loadSavedPlan(saved: SavedPracticePlan) {
    const loaded: PracticePlan = {
      ...plan,
      id: saved.id,
      status: saved.status,
      sessionType: saved.sessionType,
      title: saved.title,
      summary: saved.summary,
      totalBalls: saved.totalBalls,
      estimatedTimeMinutes: saved.timeMinutes,
      focusClubs: saved.focusClubs,
      blocks: saved.blocks,
      generation: saved.generation,
      createdAt: saved.plannedAt,
    };

    setPlan(loaded);
    setSelectedBlockId(defaultSelectedPracticeBlockId(loaded.blocks));
    setSavedPlanId(saved.id);
    setComparison(saved.result?.comparison ?? null);
    setPracticeScore(saved.result ? scoreFromSavedPlan(saved) : null);
  }

  return (
    <div className="grid gap-3 lg:gap-4">
      <PracticeSetupBar
        options={options}
        updateOptions={updateOptions}
        updateFacility={updateFacility}
        generatePlan={generatePlan}
        isPending={isPending}
        trainingBlocked={context.trainingLoad.highRecentLoad}
      />

      <PracticeSessionImportBar
        importOptions={importOptions}
        selectedImportId={selectedImportId}
        onSelect={setSelectedImportId}
        onLink={linkSelectedSession}
        savedPlanId={savedPlanId}
        hasImport={Boolean(comparison?.sourceSessionId || practiceScore)}
        isPending={isPending}
      />

      <PracticeTodayCard
        plan={plan}
        focusSummary={focusSummary}
        message={message}
      />

      <div className="grid gap-3 sm:grid-cols-12 sm:items-start">
        <div className="min-w-0 sm:col-span-5 xl:col-span-4">
          <PracticeAgenda
            blocks={plan.blocks}
            comparison={comparison}
            selectedBlockId={selectedBlock?.id ?? null}
            onSelect={setSelectedBlockId}
          />
        </div>
        <div className="min-w-0 sm:col-span-5 xl:col-span-5">
          <SelectedBlockDetail
            block={selectedBlock}
            comparison={comparison}
          />
        </div>
        <div className="min-w-0 sm:col-span-2 xl:col-span-3">
          <SessionControlPanel
            context={context}
            plan={plan}
            savedPlanId={savedPlanId}
            summary={sessionSummary}
            score={practiceScore}
            comparison={comparison}
            onSave={savePlan}
            onStart={startPractice}
            onAbandon={abandonPlan}
            isPending={isPending}
          />
        </div>
      </div>

      <PracticeLibrary
        templates={templates}
        savedPlans={localSavedPlans}
        onUseTemplate={useTemplate}
        onLoadSavedPlan={loadSavedPlan}
      />
    </div>
  );
}

function PracticeSetupBar({
  options,
  updateOptions,
  updateFacility,
  generatePlan,
  isPending,
  trainingBlocked,
}: {
  options: GeneratePracticePlanOptions;
  updateOptions: (patch: Partial<GeneratePracticePlanOptions>) => void;
  updateFacility: (patch: Partial<PracticeFacilityOptions>) => void;
  generatePlan: () => void;
  isPending: boolean;
  trainingBlocked: boolean;
}) {
  const showBalls = ["range", "course_warmup", "mixed"].includes(options.sessionType);
  const selectedBallCount = options.facility?.customBalls ? "custom" : String(options.ballCount ?? 80);

  return (
    <section className="rounded-xl border bg-white/80 p-2.5 shadow-sm ring-1 ring-emerald-950/5">
      <div className="flex flex-wrap items-end gap-2">
        <CompactSelect
          label="Session"
          value={options.sessionType}
          options={sessionTypes}
          onChange={(value) => updateOptions({ sessionType: value as PracticeSessionType })}
        />
        {showBalls ? (
          <CompactSelect
            label="Balls"
            value={selectedBallCount}
            options={[
              ...ballCounts.map((count) => ({ value: String(count), label: `${count}` })),
              { value: "custom", label: "Custom" },
            ]}
            onChange={(value) => {
              if (value === "custom") {
                updateFacility({ customBalls: options.ballCount ?? 80 });
              } else {
                updateFacility({ customBalls: null });
                updateOptions({ ballCount: Number(value) });
              }
            }}
          />
        ) : null}
        <CompactSelect
          label="Time"
          value={String(options.timeMinutes)}
          options={timeOptions.map((minutes) => ({ value: String(minutes), label: `${minutes} min` }))}
          onChange={(value) => updateOptions({ timeMinutes: Number(value) })}
        />
        <CompactSelect
          label="Energy"
          value={options.energy}
          options={energyOptions}
          onChange={(value) => updateOptions({ energy: value as PracticeEnergyLevel })}
        />
        <CompactSelect
          label="Intent"
          value={options.intent}
          options={intentOptions}
          onChange={(value) => updateOptions({ intent: value as PracticeIntent })}
        />
        <Button className="h-9 rounded-lg" onClick={generatePlan} disabled={isPending}>
          <WandSparkles className="size-4" />
          Generate
        </Button>
      </div>

      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="size-4" />
          Adjust setup
          <span className="text-xs group-open:hidden">Facility options and custom balls</span>
        </summary>
        <div className="mt-3 grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-3">
          {showBalls ? (
            <label className="grid gap-1 text-sm font-medium">
              Custom balls
              <Input
                inputMode="numeric"
                className="h-9 rounded-lg"
                value={options.facility?.customBalls?.toString() ?? ""}
                placeholder="80"
                onChange={(event) =>
                  updateFacility({
                    customBalls: Number(event.target.value) || null,
                  })
                }
              />
            </label>
          ) : null}

          {options.sessionType === "short_game" ? (
            <ToggleGroup>
              <FacilityToggle
                checked={Boolean(options.facility?.chippingGreen)}
                label="Chipping green"
                onChange={(checked) => updateFacility({ chippingGreen: checked })}
              />
              <FacilityToggle
                checked={Boolean(options.facility?.bunker)}
                label="Bunker"
                onChange={(checked) => updateFacility({ bunker: checked })}
              />
              <FacilityToggle
                checked={Boolean(options.facility?.puttingGreen)}
                label="Putting green"
                onChange={(checked) => updateFacility({ puttingGreen: checked })}
              />
            </ToggleGroup>
          ) : null}

          {options.sessionType === "speed" ? (
            <ToggleGroup>
              <FacilityToggle
                checked={Boolean(options.facility?.speedSticks)}
                label="Speed sticks"
                onChange={(checked) => updateFacility({ speedSticks: checked })}
              />
              <FacilityToggle
                checked={Boolean(options.facility?.golfClubOnly)}
                label="Golf club only"
                onChange={(checked) => updateFacility({ golfClubOnly: checked })}
              />
              <FacilityToggle
                checked={Boolean(options.facility?.rapsodoSpeed)}
                label="Rapsodo R-Speed"
                onChange={(checked) => updateFacility({ rapsodoSpeed: checked })}
              />
              {trainingBlocked ? (
                <FacilityToggle
                  checked={Boolean(options.facility?.overrideTrainingLoad)}
                  label="Override load block"
                  onChange={(checked) => updateFacility({ overrideTrainingLoad: checked })}
                />
              ) : null}
            </ToggleGroup>
          ) : null}

          {options.sessionType === "putting" ? (
            <ToggleGroup>
              <FacilityToggle
                checked={Boolean(options.facility?.indoorMat)}
                label="Indoor mat"
                onChange={(checked) => updateFacility({ indoorMat: checked })}
              />
              <label className="grid gap-1 text-sm font-medium">
                Distance available
                <Input
                  inputMode="numeric"
                  className="h-9 rounded-lg"
                  value={options.facility?.distanceAvailableFt?.toString() ?? "30"}
                  onChange={(event) =>
                    updateFacility({ distanceAvailableFt: Number(event.target.value) || 30 })
                  }
                />
              </label>
            </ToggleGroup>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function PracticeSessionImportBar({
  importOptions,
  selectedImportId,
  onSelect,
  onLink,
  savedPlanId,
  hasImport,
  isPending,
}: {
  importOptions: PracticeImportOption[];
  selectedImportId: string;
  onSelect: (sessionId: string) => void;
  onLink: () => void;
  savedPlanId: string | null;
  hasImport: boolean;
  isPending: boolean;
}) {
  const selectedSession = importOptions.find((option) => option.id === selectedImportId) ?? null;

  return (
    <section className="rounded-xl border bg-white/90 p-3 shadow-sm ring-1 ring-emerald-950/5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <p className="text-sm font-semibold">Score from uploaded session</p>
          <p className="text-xs leading-5 text-muted-foreground">
            After you upload the range session, choose it here and LM World Tour will score this
            plan from the shot data.
          </p>
        </div>

        {importOptions.length > 0 ? (
          <>
            <label className="grid min-w-[18rem] flex-1 gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Uploaded session
              <select
                className="h-9 rounded-lg border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground"
                value={selectedImportId}
                onChange={(event) => onSelect(event.target.value)}
              >
                {importOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.dateLabel} | {option.shotCount} shots | {formatSessionOptionType(option.sessionType)} | {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid min-w-[11rem] gap-1 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
              <span className="font-semibold text-foreground">
                {selectedSession ? `${selectedSession.shotCount} shots` : "No session"}
              </span>
              <span className="text-muted-foreground">
                {selectedSession
                  ? `${selectedSession.dateLabel} | ${formatSessionOptionType(selectedSession.sessionType)}`
                  : "Upload first"}
              </span>
            </div>
            <Button
              className="h-9 rounded-lg"
              onClick={onLink}
              disabled={isPending || !selectedImportId || !savedPlanId}
            >
              <Upload className="size-4" />
              {savedPlanId ? (hasImport ? "Switch session" : "Use session") : "Save plan first"}
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              No uploaded sessions found yet.
            </div>
            <Button asChild className="h-9 rounded-lg">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import data
              </Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

function PracticeTodayCard({
  plan,
  focusSummary,
  message,
}: {
  plan: PracticePlan;
  focusSummary: ReturnType<typeof buildPracticeFocusSummary>;
  message: string | null;
}) {
  const plannedBalls = plan.totalBalls === null ? "Timed" : `${plan.totalBalls} balls`;

  return (
    <section className="rounded-xl border bg-white/90 p-3 shadow-sm ring-1 ring-emerald-950/5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-900 text-white hover:bg-emerald-900">Practise this today</Badge>
            <Badge variant="outline">{plannedBalls}</Badge>
            <Badge variant="outline">{plan.estimatedTimeMinutes} min</Badge>
            <Badge variant="outline">{plan.trainingStatus}</Badge>
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">
            {focusSummary.main}
          </h2>
          <div className="mt-2 grid gap-1.5 text-sm leading-5 md:grid-cols-2">
            <FocusLine label="Secondary" value={focusSummary.secondary} />
            <FocusLine label="Scoring" value={focusSummary.scoring} />
            <FocusLine label="Maintenance" value={focusSummary.maintenance} />
            <FocusLine label="How" value={focusSummary.howToPractice} />
          </div>
        </div>

        <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm font-semibold">Why this plan</p>
          <div className="grid gap-1.5">
            {plan.why.slice(0, 4).map((line) => (
              <div key={line} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
                <span className="line-clamp-1">{line}</span>
              </div>
            ))}
          </div>
          <p className="border-t pt-2 text-xs leading-5 text-muted-foreground">
            After practice, upload the matching Rapsodo session and LM World Tour will score the
            plan from the shot data.
          </p>
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950">
          {message}
        </div>
      ) : null}
    </section>
  );
}

function formatSessionOptionType(sessionType: string) {
  return sessionType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function FocusLine({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="min-w-0 text-muted-foreground">
      <span className="font-semibold text-foreground">{label}: </span>
      <span>{value ?? "Not needed today"}</span>
    </p>
  );
}

function PracticeAgenda({
  blocks,
  comparison,
  selectedBlockId,
  onSelect,
}: {
  blocks: PracticeBlock[];
  comparison: PracticeComparison | null;
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
}) {
  const totalBalls = blocks.reduce((total, block) => total + (block.ballCount ?? 0), 0);

  return (
    <section className="rounded-xl border bg-white/85 p-3 shadow-sm ring-1 ring-emerald-950/5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-normal">Practice agenda</h3>
          <p className="text-xs text-muted-foreground">
            {blocks.length} blocks · {totalBalls} planned balls
          </p>
        </div>
        <Badge variant="outline">Scored after upload</Badge>
      </div>

      <div className="grid gap-2">
        {blocks.map((block) => {
          const row = compactPracticeBlockRow(block, comparison);
          const selected = block.id === selectedBlockId;

          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelect(block.id)}
              className={cn(
                "rounded-lg border p-2.5 text-left transition-colors",
                selected
                  ? "border-emerald-500 bg-emerald-50 shadow-sm"
                  : "bg-white/75 hover:border-emerald-300 hover:bg-emerald-50/60",
              )}
              aria-pressed={selected}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{row.blockLabel}</Badge>
                    <Badge className={blockTone(block.type)}>{row.typeLabel}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold">{row.title}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{row.volumeLabel}</span>
              </div>
              <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted-foreground">
                {row.clubLabel || "Mixed"} · target {row.successTarget}
              </p>
              <div className="mt-1.5 flex items-start justify-between gap-2">
                <Badge variant="outline" className={importStatusTone(row.importStatus)}>
                  {row.statusLabel}
                </Badge>
                <span className="min-w-0 text-right text-xs leading-5 text-muted-foreground">
                  {row.importedEvidence}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedBlockDetail({
  block,
  comparison,
}: {
  block: PracticeBlock | null;
  comparison: PracticeComparison | null;
}) {
  if (!block) {
    return (
      <section className="rounded-xl border bg-white/85 p-3 shadow-sm ring-1 ring-emerald-950/5">
        <p className="text-sm text-muted-foreground">Generate a plan to see the main practice block.</p>
      </section>
    );
  }

  const row = compactPracticeBlockRow(block, comparison);
  const decision = comparison?.decisions.find((item) => item.blockId === block.id) ?? null;

  return (
    <section className="rounded-xl border bg-white/90 p-3 shadow-sm ring-1 ring-emerald-950/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{row.blockLabel}</Badge>
            <Badge className={blockTone(block.type)}>{row.typeLabel}</Badge>
            <Badge variant="outline" className={importStatusTone(row.importStatus)}>
              {row.statusLabel}
            </Badge>
          </div>
          <h3 className="mt-2 text-2xl font-semibold tracking-normal">{block.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.clubLabel || "Mixed"} · {row.volumeLabel}
          </p>
        </div>
        <MiniMetric label="Target" value={shortTarget(block.successTarget)} />
      </div>

      <div className="mt-3 grid gap-2">
        <DetailLine label="Why" value={block.purpose} />
        <DetailLine label="How to practise" value={block.drill} />
        <DetailLine label="Success" value={block.successTarget} />
        <DetailLine label="Record" value={block.recordPrompt} />
        <DetailLine label="Scored from" value={scoredFromLabel(block)} />
      </div>

      <div className="mt-3 rounded-lg border border-dashed bg-muted/20 p-3 text-sm leading-5 text-muted-foreground">
        {decision ? (
          <>
            <p className="font-semibold text-foreground">Uploaded result: {decision.result.replace("_", " ")}</p>
            <p className="mt-1">Actual: {decision.actual}</p>
            <p>{decision.summary}</p>
          </>
        ) : (
          "Upload the matching Rapsodo session and LM World Tour will score this block from the shot data."
        )}
      </div>
    </section>
  );
}

function SessionControlPanel({
  context,
  plan,
  savedPlanId,
  summary,
  score,
  comparison,
  onSave,
  onStart,
  onAbandon,
  isPending,
}: {
  context: PracticePlannerContext;
  plan: PracticePlan;
  savedPlanId: string | null;
  summary: ReturnType<typeof summarizePracticeImportControl>;
  score: PracticeScore | null;
  comparison: PracticeComparison | null;
  onSave: () => void;
  onStart: () => void;
  onAbandon: () => void;
  isPending: boolean;
}) {
  const hasImport = Boolean(score || comparison?.sourceSessionId);
  const status = plan.status ?? (savedPlanId ? "planned" : "draft");
  const plannedBalls = plan.totalBalls ?? summary.totalBalls;
  const plannedVolume = plan.totalBalls === null ? `${plan.estimatedTimeMinutes} min` : `${plannedBalls} balls`;
  const focus = plan.focusClubs.map((club) => club.toUpperCase()).join(", ") || "Baseline";
  const statusLabel = hasImport
    ? status === "draft"
      ? "Latest session review"
      : "Analysed from upload"
    : status === "awaiting_import" || status === "match_found"
      ? "Waiting for upload"
      : status === "planned"
        ? "Saved plan"
        : status === "abandoned"
          ? "Abandoned"
          : "Draft";

  return (
    <aside className="min-w-0 max-sm:sticky max-sm:bottom-2 max-sm:z-20 sm:sticky sm:top-4 sm:self-start">
      <Card className="premium-card overflow-hidden">
        <CardHeader className="gap-3 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardCheck className="size-5 text-emerald-700" />
              Session Control
            </CardTitle>
            <CardDescription>{statusLabel}</CardDescription>
          </div>
          {hasImport ? <Progress value={summary.progressPercent} /> : null}
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric label="Planned" value={plannedVolume} />
            <MiniMetric label="Focus" value={focus} />
            <MiniMetric label="Expected" value="Rapsodo range" />
            <MiniMetric
              label="Imported"
              value={hasImport ? `${summary.importedBalls}/${summary.totalBalls}` : "0"}
            />
          </div>
          <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
            {hasImport ? (
              <>
                <p className="font-semibold text-foreground">
                  Match confidence: {comparison?.matchConfidence ?? "--"}%
                </p>
                <p>{comparison?.nextRecommendation ?? score?.nextAction}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-foreground">Match rule</p>
                <p>Auto-match uses newer uploads. If needed, choose the exact uploaded session near the top.</p>
              </>
            )}
          </div>
          <div className="grid gap-2">
            {hasImport ? (
              <Button asChild variant="outline" className="rounded-lg">
                <Link href="/today" prefetch={false}>
                  <Upload className="size-4" />
                  Review latest session
                </Link>
              </Button>
            ) : null}
            {status === "draft" ? (
              <Button onClick={onSave} disabled={isPending || Boolean(savedPlanId)} className="rounded-lg">
                <Save className="size-4" />
                {hasImport ? "Save reviewed plan" : "Save plan"}
              </Button>
            ) : null}
            {status === "planned" && !hasImport ? (
              <Button onClick={onStart} disabled={isPending || !savedPlanId} className="rounded-lg">
                <ClipboardCheck className="size-4" />
                Start practice
              </Button>
            ) : null}
            {(status === "awaiting_import" || status === "match_found" || status === "analysed") && !hasImport ? (
              <Button asChild variant="outline" className="rounded-lg">
                <Link href="/import" prefetch={false}>
                  <Upload className="size-4" />
                  Import data
                </Link>
              </Button>
            ) : null}
            {status === "draft" && !hasImport ? (
              <Button variant="outline" className="rounded-lg" disabled>
                <Upload className="size-4" />
                Import after saving
              </Button>
            ) : null}
            {(status === "planned" || status === "awaiting_import" || status === "match_found") && !hasImport ? (
              <Button variant="ghost" className="rounded-lg" onClick={onAbandon} disabled={isPending}>
                Mark abandoned
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="grid gap-3">
          <ScorecardPanel score={score} summary={summary} />
          <CoachPanel context={context} plan={plan} score={score} />
          <ImportPanel savedPlanId={savedPlanId} hasImport={hasImport} />
          {hasImport ? <PlanVsActual comparison={comparison} /> : null}
        </CardContent>
      </Card>
    </aside>
  );
}

function ScorecardPanel({
  score,
  summary,
}: {
  score: PracticeScore | null;
  summary: ReturnType<typeof summarizePracticeImportControl>;
}) {
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-sm font-semibold">Import progress</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.importedBalls}/{summary.totalBalls} planned balls found. {summary.matchedBlocks}/{summary.totalBlocks} blocks met planned volume.
        </p>
      </div>
      <div className="rounded-lg border bg-white/70 p-3">
        <p className="text-sm font-semibold">Practice Score</p>
        {score ? (
          <>
            <p className="mt-2 text-3xl font-semibold tracking-normal">
              {score.score}
              <span className="text-base text-muted-foreground"> / 100</span>
            </p>
            <Progress value={score.score} className="mt-2" />
            <p className="mt-2 text-sm text-muted-foreground">{score.nextAction}</p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Practice score appears after upload.
          </p>
        )}
      </div>
    </div>
  );
}

function PlanVsActual({ comparison }: { comparison: PracticeComparison | null }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Plan vs Actual</p>
      {comparison?.decisions.length ? (
        <>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <MiniMetric
                label="Planned"
                value={
                  comparison.planVsActual.plannedBalls
                    ? `${comparison.planVsActual.plannedBalls} balls`
                    : "Timed"
                }
              />
              <MiniMetric label="Actual" value={`${comparison.planVsActual.actualShots} shots`} />
              <MiniMetric label="Match" value={`${comparison.matchConfidence ?? "--"}%`} />
              <MiniMetric label="Mode" value={comparison.scoringMode} />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Clubs: {comparison.planVsActual.actualClubs.map((club) => club.toUpperCase()).join(", ") || "No clubs"}
            </p>
          </div>
          {comparison.decisions.slice(0, 4).map((item) => (
            <div key={item.blockId} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{item.title}</p>
                <Badge variant="outline">{item.result.replace("_", " ")}</Badge>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Target: {item.target}</p>
              <p className="text-xs leading-5 text-muted-foreground">Actual: {item.actual}</p>
              <p className="text-xs leading-5 text-muted-foreground">Summary: {item.summary}</p>
            </div>
          ))}
          {comparison.whatWorked.length || comparison.needsWork.length ? (
            <div className="rounded-lg border bg-white/70 p-3 text-xs leading-5 text-muted-foreground">
              {comparison.whatWorked.length ? (
                <p>
                  <span className="font-semibold text-foreground">Worked: </span>
                  {comparison.whatWorked.join(" ")}
                </p>
              ) : null}
              {comparison.needsWork.length ? (
                <p className="mt-1">
                  <span className="font-semibold text-foreground">Needs work: </span>
                  {comparison.needsWork.join(" ")}
                </p>
              ) : null}
              <p className="mt-1">
                <span className="font-semibold text-foreground">Next: </span>
                {comparison.nextRecommendation}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Upload the matching launch-monitor session to see whether the practice worked.
        </div>
      )}
    </div>
  );
}

function CoachPanel({
  context,
  plan,
  score,
}: {
  context: PracticePlannerContext;
  plan: PracticePlan;
  score: PracticeScore | null;
}) {
  const lead = score
    ? score.nextAction
    : context.trainingLoad.highRecentLoad
      ? "Technical practice only. Avoid speed chasing."
      : plan.postSessionRules[0];

  return (
    <div className="grid gap-2 text-sm">
      <DetailLine label="Coach note" value={lead} />
      <DetailLine label="Load" value={context.trainingLoad.recommendation} />
      <DetailLine label="Latest issue" value={context.latestPractice.scoringIssue} />
      <DetailLine label="Bag signal" value={context.bag.issues[0] ?? "Building"} />
    </div>
  );
}

function ImportPanel({
  savedPlanId,
  hasImport,
}: {
  savedPlanId: string | null;
  hasImport: boolean;
}) {
  if (hasImport) {
    return (
      <div className="grid gap-2">
        <p className="text-sm leading-6 text-muted-foreground">
          The latest uploaded session is being used for this review. Save the plan if you want
          future uploads to auto-link to it.
        </p>
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/today" prefetch={false}>
            <Target className="size-4" />
            Open latest practice
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm leading-6 text-muted-foreground">
        Upload the next matching Rapsodo session and LM World Tour will score the plan from the shot data.
      </p>
      {savedPlanId ? (
        <div className="grid gap-2">
          <Button asChild className="premium-action rounded-lg">
            <Link href="/import" prefetch={false}>
              <Upload className="size-4" />
              Upload CSV
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-lg">
            <Link href="/rapsodo" prefetch={false}>
              <Target className="size-4" />
              Sync Rapsodo
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Save this plan before importing the range session.
        </div>
      )}
    </div>
  );
}

function PracticeLibrary({
  templates,
  savedPlans,
  onUseTemplate,
  onLoadSavedPlan,
}: {
  templates: PracticeTemplateView[];
  savedPlans: SavedPracticePlan[];
  onUseTemplate: (template: PracticeTemplateView) => void;
  onLoadSavedPlan: (plan: SavedPracticePlan) => void;
}) {
  return (
    <details className="rounded-xl border bg-white/80 p-3 shadow-sm ring-1 ring-emerald-950/5">
      <summary className="cursor-pointer list-none text-sm font-semibold">
        Templates and saved practice plans
        <span className="ml-2 font-normal text-muted-foreground">
          Reuse a plan when you are not building today from the latest data.
        </span>
      </summary>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <TemplatesPanel templates={templates} onUseTemplate={onUseTemplate} />
        <SavedPlansPanel plans={savedPlans} onLoad={onLoadSavedPlan} />
      </div>
    </details>
  );
}

function TemplatesPanel({
  templates,
  onUseTemplate,
}: {
  templates: PracticeTemplateView[];
  onUseTemplate: (template: PracticeTemplateView) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Templates</p>
      {templates.slice(0, 5).map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onUseTemplate(template)}
          className="rounded-lg border bg-white/70 p-2.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/60"
        >
          <span className="block text-sm font-semibold">{template.title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {template.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function SavedPlansPanel({
  plans,
  onLoad,
}: {
  plans: SavedPracticePlan[];
  onLoad: (plan: SavedPracticePlan) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold">Saved plans</p>
      {plans.length > 0 ? (
        plans.slice(0, 5).map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onLoad(plan)}
            className="rounded-lg border bg-white/70 p-2.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/60"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{plan.title}</span>
              <Badge variant={plan.status === "analysed" || plan.status === "completed" ? "default" : "outline"}>
                {plan.status}
              </Badge>
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {plan.totalBalls ? `${plan.totalBalls} balls | ` : ""}
              {plan.timeMinutes} min | {plan.focusClubs.join(", ") || "Baseline"}
            </span>
          </button>
        ))
      ) : (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No saved user plans yet.
        </div>
      )}
    </div>
  );
}

function CompactSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <select
        className="h-9 min-w-28 rounded-lg border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return <div className="grid content-start gap-2">{children}</div>;
}

function FacilityToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />
      {label}
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-white/70 px-2.5 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function shortTarget(target: string) {
  return target.length > 28 ? `${target.slice(0, 27).trimEnd()}...` : target;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-white/60 p-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-5 text-foreground">{value}</p>
    </div>
  );
}

function blockTone(type: PracticeBlock["type"]) {
  switch (type) {
    case "warmup":
    case "warmup_round":
      return "bg-sky-100 text-sky-900 hover:bg-sky-100";
    case "scoring":
    case "short_game":
    case "putting":
      return "bg-emerald-100 text-emerald-900 hover:bg-emerald-100";
    case "speed":
      return "bg-amber-100 text-amber-950 hover:bg-amber-100";
    case "random":
    case "test":
      return "bg-violet-100 text-violet-950 hover:bg-violet-100";
    default:
      return "bg-slate-100 text-slate-900 hover:bg-slate-100";
  }
}

function importStatusTone(status: PracticeBlockImportStatus) {
  return cn(
    status === "matched_from_upload" && "border-emerald-200 bg-emerald-50 text-emerald-800",
    status === "needs_more_data" && "border-amber-200 bg-amber-50 text-amber-900",
    status === "no_matching_shots" && "border-slate-200 bg-slate-50 text-slate-700",
    status === "waiting_for_upload" && "border-slate-200 bg-slate-50 text-slate-700",
  );
}

function scoreFromSavedPlan(saved: SavedPracticePlan): PracticeScore {
  const score = saved.result?.practiceScore ?? saved.score ?? 0;

  return {
    score,
    completionPercent: score,
    verdict: saved.result?.verdict ?? "Practice imported",
    nextAction: saved.result?.nextAction ?? "Review the imported block matches.",
    mainPriority: score >= 75 ? "improved" : score >= 55 ? "mixed" : "missed",
    transfer: score >= 75 ? "strong" : score >= 55 ? "mixed" : "missed",
  };
}
