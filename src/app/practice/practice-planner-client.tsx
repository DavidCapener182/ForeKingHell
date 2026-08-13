"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  Minus,
  Plus,
  RefreshCw,
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
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import { DataTableFrame, MobileFilterSheet } from "@/components/premium";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
  accountId: string;
  context: PracticePlannerContext;
  initialPlan: PracticePlan;
  savedPlans: SavedPracticePlan[];
  templates: PracticeTemplateView[];
  importOptions: PracticeImportOption[];
  latestSessionReview: PracticeLatestSessionReview | null;
  initialOptions: GeneratePracticePlanOptions;
};

type PracticeDrillSuggestion = Pick<
  PracticeBlock,
  "type" | "title" | "purpose" | "drill" | "successTarget" | "recordPrompt" | "scoringRules"
> & {
  id: string;
  label: string;
  clubs?: string[];
  source: "original" | "alternative";
};

type PracticeDrillOptionsByBlock = Record<string, PracticeDrillSuggestion[]>;

type CanvasTextOptions = {
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  maxLines?: number;
  font: string;
  color: string;
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
const timeOptions = [20, 30, 45, 60];
const energyOptions: Array<{ value: PracticeEnergyLevel; label: string }> = [
  { value: "fresh", label: "Fresh" },
  { value: "normal", label: "Normal" },
  { value: "tired", label: "Tired" },
  { value: "niggle", label: "Managing a niggle" },
];
const intentOptions: Array<{ value: PracticeIntent; label: string }> = [
  { value: "scoring", label: "Recommended" },
  { value: "confidence", label: "Confidence" },
  { value: "latest_weakness", label: "Latest weakness" },
  { value: "round_preparation", label: "Round prep" },
  { value: "distance_mapping", label: "Distance mapping" },
  { value: "speed", label: "Speed" },
];

const practiceBlockColumns: DesktopWorkbenchColumn[] = [
  { id: "block", label: "Block", locked: true },
  { id: "type", label: "Type" },
  { id: "club", label: "Club" },
  { id: "planned-volume", label: "Planned volume" },
  { id: "target", label: "Target" },
  { id: "upload-status", label: "Upload status" },
  { id: "evidence", label: "Evidence" },
  { id: "action", label: "Action" },
];

const practiceBlockSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Awaiting upload",
    href: "/practice#practice-block-ledger",
    detail: "Keep block, club, target and upload status visible while matching a session.",
  },
  {
    title: "Plan vs actual",
    href: "/practice#practice-block-ledger",
    detail: "Review planned volume, imported evidence and next action after scoring.",
  },
  {
    title: "Coach handoff",
    href: "/practice#practice-block-ledger",
    detail: "Use club, target and evidence columns for coach notes or reports.",
  },
];

export function PracticePlannerClient({
  accountId,
  context,
  initialPlan,
  savedPlans,
  templates,
  importOptions,
  latestSessionReview,
  initialOptions,
}: PracticePlannerClientProps) {
  const [options, setOptions] = useState<GeneratePracticePlanOptions>(() =>
    normalizeInitialOptions(initialOptions),
  );
  const [plan, setPlan] = useState(initialPlan);
  const [drillOptionsByBlock, setDrillOptionsByBlock] = useState<PracticeDrillOptionsByBlock>(() =>
    buildPracticeDrillOptionsByBlock(initialPlan.blocks),
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() =>
    defaultSelectedPracticeBlockId(initialPlan.blocks),
  );
  const [savedPlanId, setSavedPlanId] = useState<string | null>(initialPlan.id ?? null);
  const [selectedImportId, setSelectedImportId] = useState(
    latestSessionReview?.sourceSessionId ?? importOptions[0]?.id ?? "",
  );
  const [localSavedPlans] = useState(savedPlans);
  const initialSavedPlan = initialPlan.id
    ? (savedPlans.find((savedPlan) => savedPlan.id === initialPlan.id) ?? null)
    : null;
  const [comparison, setComparison] = useState<PracticeComparison | null>(
    initialSavedPlan?.result?.comparison ?? latestSessionReview?.comparison ?? null,
  );
  const [practiceScore, setPracticeScore] = useState<PracticeScore | null>(
    initialSavedPlan?.result
      ? scoreFromSavedPlan(initialSavedPlan)
      : (latestSessionReview?.score ?? null),
  );
  const [message, setMessage] = useState<string | null>(
    latestSessionReview && !initialSavedPlan?.result
      ? `Latest ${latestSessionReview.importedSession.shotCount}-shot session is being used to review this plan. Incomplete planned clubs still count, but they pull the score down.`
      : null,
  );
  const [savedImageDialogOpen, setSavedImageDialogOpen] = useState(false);
  const [savedImagePreviewUrl, setSavedImagePreviewUrl] = useState<string | null>(null);
  const [rangeModeActive, setRangeModeActive] = useState(false);
  const [rangePaused, setRangePaused] = useState(false);
  const [rangeFinished, setRangeFinished] = useState(false);
  const [completedBlockIds, setCompletedBlockIds] = useState<string[]>([]);
  const [rangeNote, setRangeNote] = useState("");
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
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

  useEffect(() => {
    const cached = readActivePractice(accountId);
    if (!cached || cached.planId !== savedPlanId) return;
    const timer = window.setTimeout(() => {
      setRangeModeActive(true);
      setCompletedBlockIds(cached.completedBlockIds);
      setRangeNote(cached.note);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accountId, savedPlanId]);

  useEffect(() => {
    if (!rangeModeActive || !("wakeLock" in navigator)) return;
    let cancelled = false;
    const wakeLock = navigator.wakeLock as {
      request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
    };
    void wakeLock
      .request("screen")
      .then((sentinel) => {
        if (cancelled) return sentinel.release();
        wakeLockRef.current = sentinel;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [rangeModeActive]);

  function updateOptions(patch: Partial<GeneratePracticePlanOptions>) {
    setOptions((current) => ({ ...current, ...patch }));
  }

  function updateFacility(patch: Partial<PracticeFacilityOptions>) {
    setOptions((current) => ({
      ...current,
      facility: { ...current.facility, ...patch },
    }));
  }

  function generatePlanWithOptions(nextOptions: GeneratePracticePlanOptions) {
    setMessage(null);
    startTransition(async () => {
      const generated = await generatePracticePlanAction(nextOptions);
      setPlan(generated);
      setDrillOptionsByBlock(buildPracticeDrillOptionsByBlock(generated.blocks));
      setSelectedBlockId(defaultSelectedPracticeBlockId(generated.blocks));
      setSavedPlanId(null);
      setComparison(null);
      setPracticeScore(null);
    });
  }

  function generatePlan() {
    generatePlanWithOptions(options);
  }

  function editSelectedBlock(
    updater: (block: PracticeBlock) => PracticeBlock,
    messageText = "Practice updated. Save the edited plan before upload.",
  ) {
    const blockId = selectedBlock?.id;

    if (!blockId) {
      return;
    }

    setPlan((current) =>
      practicePlanWithEditedBlocks(
        current,
        current.blocks.map((blockItem) =>
          blockItem.id === blockId ? updater(blockItem) : blockItem,
        ),
      ),
    );
    setSavedPlanId(null);
    setComparison(null);
    setPracticeScore(null);
    setMessage(messageText);
  }

  function updateSelectedBlockBalls(ballCount: number) {
    const blockId = selectedBlock?.id;

    if (!blockId) {
      return;
    }

    setPlan((current) =>
      practicePlanWithEditedBlocks(
        current,
        updatePracticeBlockBallsWithinTotal(
          current.blocks,
          blockId,
          ballCount,
          current.totalBalls ?? totalBallsForBlocks(current.blocks),
        ),
      ),
    );
    setSavedPlanId(null);
    setComparison(null);
    setPracticeScore(null);
    setMessage("Practice volume rebalanced. Save the edited plan before upload.");
  }

  function swapSelectedBlockDrill(suggestionId: string) {
    const blockId = selectedBlock?.id;
    const drillOptions = blockId ? (drillOptionsByBlock[blockId] ?? []) : [];

    editSelectedBlock(
      (blockItem) => applyPracticeDrillSuggestion(blockItem, suggestionId, drillOptions),
      "Practice drill swapped. Save the edited plan before upload.",
    );
  }

  function suggestSelectedBlockDrill() {
    if (!selectedBlock) {
      return;
    }

    const suggestion = nextPracticeDrillSuggestion(
      selectedBlock,
      drillOptionsByBlock[selectedBlock.id] ?? [],
    );

    if (!suggestion) {
      return;
    }

    swapSelectedBlockDrill(suggestion.id);
  }

  function openSavedImageDialog(showPngPreview = false) {
    setSavedImagePreviewUrl(showPngPreview ? practicePlanImageDataUrl(plan) : null);
    setSavedImageDialogOpen(true);
  }

  function updateSavedImageDialogOpen(nextOpen: boolean) {
    setSavedImageDialogOpen(nextOpen);

    if (!nextOpen) {
      setSavedImagePreviewUrl(null);
    }
  }

  function savePlan() {
    setMessage(null);
    startTransition(async () => {
      const result = await savePracticePlanAction(plan);
      setSavedPlanId(result.planId);
      setPlan((current) => ({ ...current, id: result.planId, status: "planned" }));
      setComparison(null);
      setPracticeScore(null);
      setMessage(
        "Plan saved. It is waiting for the next uploaded range session; older uploads will not score this practice.",
      );
      openSavedImageDialog(false);
    });
  }

  function saveAndStartPractice() {
    setMessage(null);
    startTransition(async () => {
      const result = await savePracticePlanAction(plan);
      await startPracticePlanAction(result.planId);
      setSavedPlanId(result.planId);
      setPlan((current) => ({ ...current, id: result.planId, status: "awaiting_import" }));
      setComparison(null);
      setPracticeScore(null);
      setRangeModeActive(true);
      setRangePaused(false);
      setRangeFinished(false);
      setCompletedBlockIds([]);
      setSelectedBlockId(defaultSelectedPracticeBlockId(plan.blocks));
      cacheActivePractice(accountId, result.planId, [], "");
      setMessage(
        "Practice saved and Range Mode started. Manual completion records activity, not measured success.",
      );
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
      setRangeModeActive(true);
      setRangePaused(false);
      setRangeFinished(false);
      cacheActivePractice(accountId, savedPlanId, completedBlockIds, rangeNote);
      setMessage(
        "Practice started. Upload or sync the matching launch-monitor session when finished.",
      );
    });
  }

  function updateRangeNote(note: string) {
    setRangeNote(note);
    if (savedPlanId) cacheActivePractice(accountId, savedPlanId, completedBlockIds, note);
  }

  function completeCurrentRangeBlock() {
    if (!selectedBlock) return;
    const nextCompleted = completedBlockIds.includes(selectedBlock.id)
      ? completedBlockIds
      : [...completedBlockIds, selectedBlock.id];
    setCompletedBlockIds(nextCompleted);
    if (savedPlanId) cacheActivePractice(accountId, savedPlanId, nextCompleted, rangeNote);
    const currentIndex = plan.blocks.findIndex((block) => block.id === selectedBlock.id);
    const nextBlock = plan.blocks[currentIndex + 1];
    if (nextBlock) setSelectedBlockId(nextBlock.id);
  }

  function moveRangeBlock(direction: -1 | 1) {
    if (!selectedBlock) return;
    const currentIndex = plan.blocks.findIndex((block) => block.id === selectedBlock.id);
    const nextBlock = plan.blocks[currentIndex + direction];
    if (nextBlock) setSelectedBlockId(nextBlock.id);
  }

  function finishRangeWithoutUpload() {
    clearActivePractice(accountId);
    setRangeModeActive(false);
    setRangePaused(false);
    setRangeFinished(true);
    setMessage(
      "Activity completed manually. No block has been marked as measured success; import evidence when available.",
    );
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
    generatePlanWithOptions(nextOptions);
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
    setDrillOptionsByBlock(buildPracticeDrillOptionsByBlock(loaded.blocks));
    setSelectedBlockId(defaultSelectedPracticeBlockId(loaded.blocks));
    setSavedPlanId(saved.id);
    setComparison(saved.result?.comparison ?? null);
    setPracticeScore(saved.result ? scoreFromSavedPlan(saved) : null);
  }

  return (
    <div
      id="practice-plan"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 scroll-mt-28 lg:gap-4"
    >
      <div className="grid gap-3 lg:hidden">
        {rangeModeActive ? (
          <ActiveRangeMode
            plan={plan}
            block={selectedBlock}
            completedBlockIds={completedBlockIds}
            note={rangeNote}
            onNoteChange={updateRangeNote}
            onPrevious={() => moveRangeBlock(-1)}
            onNext={() => moveRangeBlock(1)}
            onCompleteBlock={completeCurrentRangeBlock}
            onPause={() => {
              setRangeModeActive(false);
              setRangePaused(true);
            }}
            onFinishWithoutUpload={finishRangeWithoutUpload}
          />
        ) : (
          <>
            {rangeFinished ? <PracticeFinishedActions /> : null}
            {rangePaused ? (
              <Button
                type="button"
                className="min-h-12 rounded-xl"
                onClick={() => {
                  setRangeModeActive(true);
                  setRangePaused(false);
                }}
              >
                Resume Range Mode
              </Button>
            ) : null}
            <PracticeMobileTask
              plan={plan}
              block={selectedBlock}
              comparison={comparison}
              score={practiceScore}
              savedPlanId={savedPlanId}
              message={message}
              isPending={isPending}
              onSaveAndStart={saveAndStartPractice}
              onStart={startPractice}
              onGenerate={generatePlan}
            />

            <PracticeMobileBlockPicker
              blocks={plan.blocks}
              selectedBlockId={selectedBlock?.id ?? null}
              comparison={comparison}
              onSelect={setSelectedBlockId}
            />

            <MobileFilterSheet label="Quick adjustments">
              <div className="pb-3 [&_button]:min-h-11 [&_input]:min-h-11 [&_select]:min-h-11">
                <PracticeSetupBar
                  options={options}
                  updateOptions={updateOptions}
                  updateFacility={updateFacility}
                  generatePlan={generatePlan}
                  isPending={isPending}
                  trainingBlocked={context.trainingLoad.highRecentLoad}
                />
              </div>
            </MobileFilterSheet>

            <IOSDisclosureGroup
              label="Practice plan support"
              items={[
                {
                  value: "why",
                  title: "Why this plan?",
                  summary: `${plan.why.length} signals`,
                  description: "Latest weakness, bag trust and training context",
                  content: <PracticeMobileWhy plan={plan} context={context} />,
                },
                ...(comparison || practiceScore
                  ? [
                      {
                        value: "result",
                        title: "Plan versus actual",
                        summary: practiceScore ? `${practiceScore.score}/100` : "Measured",
                        description: "Imported evidence and the next recommendation",
                        content: (
                          <PracticeMobileResult
                            comparison={comparison}
                            score={practiceScore}
                            summary={sessionSummary}
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </>
        )}
      </div>

      <div className="hidden min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid">
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

        <PracticeTodayCard plan={plan} focusSummary={focusSummary} message={message} />
        <PracticeResultsOverview
          comparison={comparison}
          score={practiceScore}
          summary={sessionSummary}
        />

        <div className="grid gap-3 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-5 xl:col-span-4">
            <PracticeAgenda
              blocks={plan.blocks}
              comparison={comparison}
              selectedBlockId={selectedBlock?.id ?? null}
              onSelect={setSelectedBlockId}
            />
          </div>
          <div className="min-w-0 lg:sticky lg:top-4 lg:col-span-5 lg:self-start xl:col-span-5">
            <SelectedBlockDetail
              block={selectedBlock}
              comparison={comparison}
              drillOptions={selectedBlock ? (drillOptionsByBlock[selectedBlock.id] ?? []) : []}
              onBallCountChange={updateSelectedBlockBalls}
              onSwapDrill={swapSelectedBlockDrill}
              onSuggestDrill={suggestSelectedBlockDrill}
              isPending={isPending}
            />
          </div>
          <div className="min-w-0 lg:col-span-2 xl:col-span-3">
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
              onShowPracticeImage={() => openSavedImageDialog(true)}
              isPending={isPending}
            />
          </div>
        </div>

        {comparison?.decisions.length ? <PlanVsActual comparison={comparison} /> : null}
        <PracticeBlockLedger blocks={plan.blocks} comparison={comparison} />

        <PracticeLibrary
          templates={templates}
          savedPlans={localSavedPlans}
          onUseTemplate={useTemplate}
          onLoadSavedPlan={loadSavedPlan}
        />
      </div>

      <PracticePlanImageDialog
        open={savedImageDialogOpen}
        onOpenChange={updateSavedImageDialogOpen}
        plan={plan}
        savedPlanId={savedPlanId}
        pngPreviewUrl={savedImagePreviewUrl}
        onPngPreviewChange={setSavedImagePreviewUrl}
      />
    </div>
  );
}

function ActiveRangeMode({
  plan,
  block,
  completedBlockIds,
  note,
  onNoteChange,
  onPrevious,
  onNext,
  onCompleteBlock,
  onPause,
  onFinishWithoutUpload,
}: {
  plan: PracticePlan;
  block: PracticeBlock | null;
  completedBlockIds: string[];
  note: string;
  onNoteChange: (note: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onCompleteBlock: () => void;
  onPause: () => void;
  onFinishWithoutUpload: () => void;
}) {
  const currentIndex = block ? plan.blocks.findIndex((item) => item.id === block.id) : -1;
  const row = block ? compactPracticeBlockRow(block, null) : null;
  const allBlocksComplete =
    plan.blocks.length > 0 && plan.blocks.every((item) => completedBlockIds.includes(item.id));

  return (
    <section className="grid min-h-[calc(100dvh-9rem)] content-start gap-4" data-active-range-mode>
      <div className="ios-grouped-list grid gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Range Mode · Block {Math.max(1, currentIndex + 1)} of {plan.blocks.length}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {row?.clubLabel || "Mixed clubs"}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              {row?.volumeLabel ?? "Timed block"}
            </p>
          </div>
          <IOSInlineStatus
            label={`${completedBlockIds.length}/${plan.blocks.length} complete`}
            tone={allBlocksComplete ? "positive" : "info"}
          />
        </div>

        <div className="rounded-xl bg-secondary/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Target
          </p>
          <p className="mt-1 text-lg font-semibold leading-6">
            {block?.successTarget ?? "Choose a block"}
          </p>
          <p className="mt-4 border-t border-border/70 pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Do this now
          </p>
          <p className="mt-1 text-[15px] leading-6">{block?.drill ?? plan.summary}</p>
        </div>

        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            disabled={currentIndex <= 0}
            onClick={onPrevious}
            aria-label="Previous block"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <Button
            type="button"
            className="min-h-11 rounded-xl"
            onClick={onCompleteBlock}
            disabled={!block}
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Complete block
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            disabled={currentIndex < 0 || currentIndex >= plan.blocks.length - 1}
            onClick={onNext}
            aria-label="Next block"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Completing a block records the activity only. Targets remain unmeasured until matching
          launch-monitor evidence is imported.
        </p>
      </div>

      <label className="ios-grouped-list grid gap-2 p-4 text-sm font-semibold">
        Short note
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Feel, strike or context"
          className="min-h-20 resize-none rounded-xl border bg-background px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <div className="grid gap-2">
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={onPause}>
          Pause session
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href="/rapsodo">Sync Rapsodo</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href="/import">Upload CSV</Link>
        </Button>
        <Button type="button" className="min-h-11 rounded-xl" onClick={onFinishWithoutUpload}>
          Finish without upload
        </Button>
      </div>
    </section>
  );
}

function PracticeFinishedActions() {
  return (
    <section className="ios-grouped-list grid gap-3 p-5" data-practice-finished>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Practice complete
        </p>
        <h2 className="mt-1 text-xl font-bold">Add evidence when it is ready</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Manual block completion is recorded separately from measured target success.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild className="min-h-11 rounded-xl">
          <Link href="/rapsodo">Sync Rapsodo</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href="/import">Upload CSV</Link>
        </Button>
      </div>
    </section>
  );
}

type CachedActivePractice = {
  planId: string;
  completedBlockIds: string[];
  note: string;
};

function activePracticeStorageKey(accountId: string) {
  return `fkh:active-practice:${accountId}`;
}

function cacheActivePractice(
  accountId: string,
  planId: string,
  completedBlockIds: string[],
  note: string,
) {
  try {
    window.localStorage.setItem(
      activePracticeStorageKey(accountId),
      JSON.stringify({ planId, completedBlockIds, note } satisfies CachedActivePractice),
    );
  } catch {
    // Storage can be unavailable in strict or private browsing modes.
  }
}

function readActivePractice(accountId: string): CachedActivePractice | null {
  try {
    const value = window.localStorage.getItem(activePracticeStorageKey(accountId));
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<CachedActivePractice>;
    if (typeof parsed.planId !== "string") return null;
    return {
      planId: parsed.planId,
      completedBlockIds: Array.isArray(parsed.completedBlockIds)
        ? parsed.completedBlockIds.filter((id): id is string => typeof id === "string")
        : [],
      note: typeof parsed.note === "string" ? parsed.note : "",
    };
  } catch {
    return null;
  }
}

function clearActivePractice(accountId: string) {
  try {
    window.localStorage.removeItem(activePracticeStorageKey(accountId));
  } catch {
    // Storage can be unavailable in strict or private browsing modes.
  }
}

function PracticeMobileTask({
  plan,
  block,
  comparison,
  score,
  savedPlanId,
  message,
  isPending,
  onSaveAndStart,
  onStart,
  onGenerate,
}: {
  plan: PracticePlan;
  block: PracticeBlock | null;
  comparison: PracticeComparison | null;
  score: PracticeScore | null;
  savedPlanId: string | null;
  message: string | null;
  isPending: boolean;
  onSaveAndStart: () => void;
  onStart: () => void;
  onGenerate: () => void;
}) {
  const status = plan.status ?? (savedPlanId ? "planned" : "draft");
  const hasImport = Boolean(score || comparison?.sourceSessionId);
  const row = block ? compactPracticeBlockRow(block, comparison) : null;
  const decision = block
    ? (comparison?.decisions.find((item) => item.blockId === block.id) ?? null)
    : null;

  return (
    <section
      className="overflow-hidden rounded-[1rem] border border-border bg-card shadow-sm"
      aria-labelledby="practice-current-task"
      data-practice-mobile-task
    >
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.035em] text-primary">
              {block ? `Block ${block.order} · ${row?.typeLabel}` : "Today's practice"}
            </p>
            <h2
              id="practice-current-task"
              className="mt-1 text-[26px] font-bold leading-8 tracking-[-0.025em]"
            >
              {block?.title ?? plan.title}
            </h2>
            <p className="mt-1 text-[15px] leading-5 text-muted-foreground">
              {row ? `${row.clubLabel || "Mixed"} · ${row.volumeLabel}` : plan.summary}
            </p>
          </div>
          <IOSInlineStatus
            label={practiceMobileStatusLabel(plan, savedPlanId, score, comparison)}
            tone={hasImport ? "positive" : status === "abandoned" ? "attention" : "info"}
          />
        </div>

        {block ? (
          <div className="grid gap-2 rounded-xl bg-secondary/60 px-3 py-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Target</p>
              <p className="mt-0.5 text-[16px] font-semibold leading-5">{block.successTarget}</p>
            </div>
            <div className="border-t border-border/70 pt-2">
              <p className="text-[13px] text-muted-foreground">Do this now</p>
              <p className="mt-0.5 text-[15px] leading-5">{block.drill}</p>
            </div>
            {decision ? (
              <IOSInlineStatus
                label={`${practiceComparisonResultLabel(decision)} · ${decision.actualBalls} shots`}
                tone={decision.result === "passed" ? "positive" : "attention"}
              />
            ) : null}
          </div>
        ) : null}

        <div data-primary-action>
          {hasImport ? (
            <Button asChild className="min-h-12 w-full rounded-xl">
              <Link href="/today" prefetch={false}>
                <Target className="size-4" />
                Review measured result
              </Link>
            </Button>
          ) : status === "draft" ? (
            <Button
              type="button"
              onClick={onSaveAndStart}
              disabled={isPending || Boolean(savedPlanId)}
              className="min-h-12 w-full rounded-xl"
            >
              <Save className="size-4" />
              Save &amp; Start Practice
            </Button>
          ) : status === "planned" ? (
            <Button
              type="button"
              onClick={onStart}
              disabled={isPending || !savedPlanId}
              className="min-h-12 w-full rounded-xl"
            >
              <ClipboardCheck className="size-4" />
              Resume Range Mode
            </Button>
          ) : status === "awaiting_import" || status === "match_found" ? (
            <Button asChild className="min-h-12 w-full rounded-xl">
              <Link href="/import" prefetch={false}>
                <Upload className="size-4" />
                Import practice evidence
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isPending}
              className="min-h-12 w-full rounded-xl"
            >
              <WandSparkles className="size-4" />
              Generate a fresh plan
            </Button>
          )}
        </div>
      </div>
      {message ? (
        <p
          aria-live="polite"
          className="border-t border-border/70 bg-secondary/45 px-4 py-3 text-[13px] leading-5"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}

function PracticeMobileBlockPicker({
  blocks,
  selectedBlockId,
  comparison,
  onSelect,
}: {
  blocks: PracticeBlock[];
  selectedBlockId: string | null;
  comparison: PracticeComparison | null;
  onSelect: (blockId: string) => void;
}) {
  return (
    <section className="grid gap-2" aria-labelledby="practice-block-picker">
      <IOSSectionHeader
        title={<span id="practice-block-picker">Practice blocks</span>}
        description="Switch the active task without scrolling through every drill."
      />
      <div
        className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
        role="toolbar"
        aria-label="Choose a practice block"
      >
        {blocks.map((block) => {
          const selected = block.id === selectedBlockId;
          const row = compactPracticeBlockRow(block, comparison);

          return (
            <button
              key={block.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(block.id)}
              className={cn(
                "focus-aaa min-h-11 w-[8.5rem] shrink-0 snap-start rounded-xl border px-3 py-2 text-left outline-none",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              <span className="block text-xs font-medium opacity-75">Block {block.order}</span>
              <span className="mt-0.5 block line-clamp-1 text-sm font-semibold">{block.title}</span>
              <span className="mt-0.5 block text-xs opacity-75">{row.volumeLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PracticeMobileWhy({
  plan,
  context,
}: {
  plan: PracticePlan;
  context: PracticePlannerContext;
}) {
  return (
    <IOSGroupedList label="Practice selection evidence" className="bg-card">
      {plan.why.map((line, index) => (
        <IOSListRow key={`${index}-${line}`} label={line} icon={CheckCircle2} />
      ))}
      <IOSListRow
        label="Training load"
        value={context.trainingLoad.statusLabel}
        detail={context.trainingLoad.recommendation}
        status={
          <IOSInlineStatus
            label={
              context.trainingLoad.highRecentLoad ? "Protect recovery" : "Load supports practice"
            }
            tone={context.trainingLoad.highRecentLoad ? "attention" : "positive"}
          />
        }
      />
    </IOSGroupedList>
  );
}

function PracticeMobileResult({
  comparison,
  score,
  summary,
}: {
  comparison: PracticeComparison | null;
  score: PracticeScore | null;
  summary: ReturnType<typeof summarizePracticeImportControl>;
}) {
  if (!comparison?.decisions.length) {
    return (
      <IOSGroupedList label="Practice result state" className="bg-card">
        <IOSListRow
          label="Waiting for measured evidence"
          detail="Save and complete the practice, then link the matching launch-monitor session."
          href="/import"
          icon={Upload}
        />
      </IOSGroupedList>
    );
  }

  return (
    <IOSGroupedList label="Plan versus actual result" className="bg-card">
      <IOSListRow
        label="Planned drill score"
        value={score ? `${score.score}/100` : "--"}
        detail={score?.nextAction ?? comparison.nextRecommendation}
        status={
          <IOSInlineStatus
            label={`${summary.matchedBlocks}/${summary.totalBlocks} blocks met planned volume`}
            tone={summary.matchedBlocks === summary.totalBlocks ? "positive" : "attention"}
          />
        }
      />
      {comparison.decisions.map((decision) => (
        <IOSListRow
          key={decision.blockId}
          label={decision.title}
          value={practiceComparisonResultLabel(decision)}
          detail={`${decision.actual} · ${decision.summary}`}
          status={
            <IOSInlineStatus
              label={`${decision.actualBalls}/${decision.plannedBalls ?? "--"} planned shots`}
              tone={decision.result === "passed" ? "positive" : "attention"}
            />
          }
        />
      ))}
    </IOSGroupedList>
  );
}

function practiceMobileStatusLabel(
  plan: PracticePlan,
  savedPlanId: string | null,
  score: PracticeScore | null,
  comparison: PracticeComparison | null,
) {
  if (score || comparison?.sourceSessionId) return "Measured";

  const status = plan.status ?? (savedPlanId ? "planned" : "draft");

  if (status === "awaiting_import" || status === "match_found") return "Awaiting upload";
  if (status === "planned") return "Ready to start";
  if (status === "abandoned") return "Abandoned";
  if (status === "completed" || status === "analysed") return "Complete";
  return "Draft";
}

function PracticePlanImageDialog({
  open,
  onOpenChange,
  plan,
  savedPlanId,
  pngPreviewUrl,
  onPngPreviewChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PracticePlan;
  savedPlanId: string | null;
  pngPreviewUrl: string | null;
  onPngPreviewChange: (url: string | null) => void;
}) {
  const plannedVolume =
    plan.totalBalls === null ? `${plan.estimatedTimeMinutes} min` : `${plan.totalBalls} balls`;
  const focus = plan.focusClubs.map((club) => club.toUpperCase()).join(", ") || "Practice";

  function showPngPreview() {
    onPngPreviewChange(practicePlanImageDataUrl(plan));
  }

  function savePng() {
    const dataUrl = pngPreviewUrl ?? practicePlanImageDataUrl(plan);

    onPngPreviewChange(dataUrl);
    downloadPracticePlanImage(dataUrl, plan, savedPlanId);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onPngPreviewChange(null);
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="grid h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b bg-card p-4 text-foreground">
          <DialogTitle>Saved practice reference</DialogTitle>
          <DialogDescription>
            Save this image to your phone so the range blocks are easy to follow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 overflow-hidden lg:grid-cols-[minmax(24rem,0.9fr)_minmax(30rem,1.1fr)]">
          <div className="min-h-0 overflow-y-auto bg-muted p-3 lg:bg-[#f8f7ed]">
            <div className="overflow-hidden rounded-lg border bg-card shadow-inner">
              <div className="rounded-t-lg border-b border-border bg-card p-4 text-foreground lg:border-transparent lg:bg-[#0b5130] lg:text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:text-emerald-100">
                  LM World Tour
                </p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-semibold tracking-normal">{plan.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground lg:text-emerald-50">
                      {plan.summary}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted px-3 py-2 text-right lg:border-white/20 lg:bg-white/10">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground lg:text-emerald-100">
                      Reference
                    </p>
                    <p className="text-sm font-semibold">{plannedVolume}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 bg-card p-3 sm:grid-cols-3">
                <MiniMetric label="Planned" value={plannedVolume} />
                <MiniMetric label="Time" value={`${plan.estimatedTimeMinutes} min`} />
                <MiniMetric label="Focus" value={focus} />
              </div>

              <div className="grid gap-2 bg-card px-3 pb-3">
                {plan.blocks.map((block) => (
                  <div key={block.id} className="rounded-lg border bg-emerald-50/30 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Block {block.order}</Badge>
                          <Badge className={blockTone(block.type)}>
                            {block.type.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-2 font-semibold">{block.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatClubList(block.clubs)} | {block.ballCount ?? block.timeMinutes}{" "}
                          {block.ballCount === null ? "min" : "balls"}
                        </p>
                      </div>
                      <span className="rounded-md border bg-background px-2 py-1 text-xs font-semibold">
                        Target: {shortTarget(block.successTarget)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-5">{block.drill}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto border-t bg-muted p-3 lg:border-l lg:border-t-0 lg:bg-[#f6f4e7]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">PNG preview</p>
              <Badge variant="outline">{pngPreviewUrl ? "Generated" : "Not generated"}</Badge>
            </div>

            {pngPreviewUrl ? (
              <div className="mt-3 overflow-auto rounded-lg border bg-card p-2">
                <Image
                  src={pngPreviewUrl}
                  alt="Saved practice reference PNG preview"
                  width={1200}
                  height={practicePlanImageHeight(plan)}
                  unoptimized
                  className="h-auto w-full rounded-md"
                />
              </div>
            ) : (
              <div className="mt-3 grid min-h-80 place-items-center rounded-lg border border-dashed bg-card p-6 text-center">
                <div className="max-w-sm">
                  <Eye className="mx-auto size-8 text-emerald-700" />
                  <p className="mt-3 text-sm font-semibold">Generate the practice PNG</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    The image version appears here, ready to save or screenshot before practice.
                  </p>
                  <Button type="button" className="mt-4 rounded-lg" onClick={showPngPreview}>
                    <Eye className="size-4" />
                    Show PNG
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" variant="outline" className="rounded-lg" onClick={showPngPreview}>
            <Eye className="size-4" />
            Show PNG
          </Button>
          <Button type="button" className="rounded-lg" onClick={savePng}>
            <Download className="size-4" />
            Save as image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PracticeBlockLedger({
  blocks,
  comparison,
}: {
  blocks: PracticeBlock[];
  comparison: PracticeComparison | null;
}) {
  const rows = blocks.map((block) => {
    const row = compactPracticeBlockRow(block, comparison);
    const decision = comparison?.decisions.find((item) => item.blockId === block.id) ?? null;

    return { block, row, decision };
  });
  const matchedRows = rows.filter((item) => item.decision && item.decision.actualBalls > 0).length;
  const resultLabel =
    matchedRows > 0 ? `${matchedRows}/${rows.length} blocks matched` : `${rows.length} blocks`;

  return (
    <section
      id="practice-block-ledger"
      data-workbench-scope="practice-blocks"
      className="scroll-mt-28 rounded-xl border bg-white/90 p-3 shadow-sm ring-1 ring-emerald-950/5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-normal">Practice block ledger</h3>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
            Exportable plan-vs-upload evidence for every drill block before the practice becomes a
            coach note or report.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {resultLabel}
        </Badge>
      </div>

      <DesktopTableWorkbenchControls
        viewKey="practice-blocks"
        scope="practice-blocks"
        currentViewLabel="Practice block ledger"
        resultLabel={resultLabel}
        columns={practiceBlockColumns}
        suggestedViews={practiceBlockSuggestedViews}
        exportTableId="practice-blocks"
        exportFileName="forekinghell-practice-block-ledger.csv"
        className="my-3"
      />

      <DataTableFrame mainTable mainTableLabel="Practice block ledger table" stickyFirstColumn>
        <Table
          data-workbench-export-table="practice-blocks"
          aria-describedby="practice-block-ledger-summary"
        >
          <TableCaption id="practice-block-ledger-summary" className="sr-only">
            Practice block ledger showing block, type, club, planned volume, target, upload status,
            imported evidence and recommended action.
          </TableCaption>
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-white">
            <TableRow>
              <TableHead
                data-column="block"
                className="sticky left-0 z-20 min-w-56 bg-white shadow-[1px_0_0_rgba(15,23,42,0.08)]"
              >
                Block
              </TableHead>
              <TableHead data-column="type">Type</TableHead>
              <TableHead data-column="club">Club</TableHead>
              <TableHead data-column="planned-volume">Planned volume</TableHead>
              <TableHead data-column="target">Target</TableHead>
              <TableHead data-column="upload-status">Upload status</TableHead>
              <TableHead data-column="evidence">Evidence</TableHead>
              <TableHead data-column="action" className="text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map(({ block, row, decision }) => (
                <TableRow key={block.id} tabIndex={0} className="focus-aaa outline-none">
                  <TableCell
                    data-column="block"
                    className="sticky left-0 z-10 min-w-56 bg-white font-medium shadow-[1px_0_0_rgba(15,23,42,0.08)]"
                  >
                    <span className="block max-w-64 truncate">{row.blockLabel}</span>
                    <span className="mt-1 block max-w-64 truncate text-xs text-muted-foreground">
                      {row.title}
                    </span>
                  </TableCell>
                  <TableCell data-column="type" className="capitalize">
                    {row.typeLabel}
                  </TableCell>
                  <TableCell data-column="club">{row.clubLabel || "Mixed"}</TableCell>
                  <TableCell data-column="planned-volume">{row.volumeLabel}</TableCell>
                  <TableCell data-column="target" className="min-w-64">
                    {row.successTarget}
                  </TableCell>
                  <TableCell data-column="upload-status">
                    <Badge variant="outline" className={importStatusTone(row.importStatus)}>
                      {row.statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell data-column="evidence" className="min-w-56">
                    {row.importedEvidence}
                  </TableCell>
                  <TableCell data-column="action" className="min-w-44 text-right">
                    {practiceDecisionAction(decision)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={practiceBlockColumns.length} className="h-24 text-center">
                  Generate a plan to create the practice ledger.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableFrame>
    </section>
  );
}

function normalizeInitialOptions(
  options: GeneratePracticePlanOptions,
): GeneratePracticePlanOptions {
  return {
    sessionType: options.sessionType,
    ballCount: options.ballCount ?? 80,
    timeMinutes: options.timeMinutes,
    energy: options.energy,
    intent: options.intent,
    facility: {
      chippingGreen: true,
      bunker: true,
      puttingGreen: true,
      distanceAvailableFt: 30,
      speedSticks: false,
      golfClubOnly: true,
      rapsodoSpeed: true,
      overrideTrainingLoad: false,
      ...options.facility,
    },
  };
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
  const selectedBallCount = options.facility?.customBalls
    ? "custom"
    : String(options.ballCount ?? 80);

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
          options={timeOptions.map((minutes) => ({
            value: String(minutes),
            label: `${minutes} min`,
          }))}
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

      <Collapsible className="group mt-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="justify-start px-0 text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            Adjust setup
            <span className="text-xs group-data-[state=open]:hidden">
              Facility options and custom balls
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-3">
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
        </CollapsibleContent>
      </Collapsible>
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
    <section className="min-w-0 overflow-hidden rounded-xl border bg-white/90 p-3 shadow-sm ring-1 ring-emerald-950/5">
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <div className="min-w-0 flex-[1_1_16rem]">
          <p className="text-sm font-semibold">Score the planned drill</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Choose an uploaded range session and LM World Tour will score this plan from its shot
            data. This does not grade the whole session.
          </p>
        </div>

        {importOptions.length > 0 ? (
          <>
            <label className="grid min-w-0 flex-[1_1_18rem] gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Uploaded session
              <Select value={selectedImportId} onValueChange={onSelect}>
                <SelectTrigger className="h-9 w-full min-w-0 max-w-full normal-case tracking-normal">
                  <SelectValue placeholder="Choose uploaded session" />
                </SelectTrigger>
                <SelectContent>
                  {importOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.dateLabel} | {option.shotCount} shots |{" "}
                      {formatSessionOptionType(option.sessionType)} | {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Badge className="bg-emerald-900 text-white hover:bg-emerald-900">
              Practise this today
            </Badge>
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

function PracticeResultsOverview({
  comparison,
  score,
  summary,
}: {
  comparison: PracticeComparison | null;
  score: PracticeScore | null;
  summary: ReturnType<typeof summarizePracticeImportControl>;
}) {
  if (!comparison?.decisions.length) {
    return null;
  }

  const decisionsWithEvidence = comparison.decisions.filter((item) => item.actualBalls > 0);
  const passed = decisionsWithEvidence.filter((item) => item.result === "passed");
  const repeat = decisionsWithEvidence.filter((item) => item.result === "mixed");
  const missed = decisionsWithEvidence.filter(
    (item) => item.result === "failed" || item.result === "insufficient_data",
  );
  const volumeShort = decisionsWithEvidence.filter((item) => !item.matchedPlannedVolume);
  const importedSessionLabel = comparison.importedSession
    ? `${comparison.importedSession.shotCount}-shot ${formatSessionOptionType(
        comparison.importedSession.sessionType,
      ).toLowerCase()} · ${comparison.importedSession.dateLabel}`
    : `${comparison.planVsActual.actualShots} imported shots`;

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 shadow-sm ring-1 ring-emerald-950/5 max-lg:border-slate-200 max-lg:bg-white max-lg:shadow-none max-lg:ring-0">
      <div className="grid gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-900 text-white hover:bg-emerald-900">
              Analysed from upload
            </Badge>
            <Badge variant="outline">{importedSessionLabel}</Badge>
            <Badge variant="outline">{comparison.matchConfidence ?? "--"}% match</Badge>
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-normal">
            Practice result: {score ? `${score.score}/100` : "session matched"}
          </h3>
          <p className="mt-1 max-w-5xl text-sm leading-5 text-emerald-950/80 max-lg:text-slate-600">
            {comparison.summary}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MiniMetric
            label="Matched balls"
            value={`${summary.importedBalls}/${summary.totalBalls}`}
          />
          <MiniMetric
            label="Blocks scored"
            value={`${decisionsWithEvidence.length}/${comparison.decisions.length}`}
          />
          <MiniMetric label="Passed" value={`${passed.length}`} />
          <MiniMetric label="Repeat" value={`${repeat.length + missed.length}`} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
        <ResultCallout
          label="Worked"
          value={
            comparison.whatWorked.length
              ? comparison.whatWorked.join(" ")
              : "No block reached a clear passed result."
          }
        />
        <ResultCallout
          label="Repeat"
          value={
            comparison.needsWork.length
              ? comparison.needsWork.join(" ")
              : "No repeat block flagged from this upload."
          }
        />
        <ResultCallout
          label="Volume"
          value={
            volumeShort.length
              ? `${volumeShort.length} blocks were short of the planned ball count but still carry evidence.`
              : "Every matched block met planned volume."
          }
        />
      </div>
    </section>
  );
}

function ResultCallout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white/75 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-3 text-sm leading-5 text-foreground">{value}</p>
    </div>
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
                <div className="min-w-0 text-right text-xs leading-5 text-muted-foreground">
                  <p>{row.resultNote}</p>
                  {row.importedEvidence !== "Scored after upload." ? (
                    <p className="line-clamp-2">{row.importedEvidence}</p>
                  ) : null}
                </div>
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
  drillOptions,
  onBallCountChange,
  onSwapDrill,
  onSuggestDrill,
  isPending,
}: {
  block: PracticeBlock | null;
  comparison: PracticeComparison | null;
  drillOptions: PracticeDrillSuggestion[];
  onBallCountChange: (ballCount: number) => void;
  onSwapDrill: (suggestionId: string) => void;
  onSuggestDrill: () => void;
  isPending: boolean;
}) {
  if (!block) {
    return (
      <section className="rounded-xl border bg-white/85 p-3 shadow-sm ring-1 ring-emerald-950/5">
        <p className="text-sm text-muted-foreground">
          Generate a plan to see the main practice block.
        </p>
      </section>
    );
  }

  const row = compactPracticeBlockRow(block, comparison);
  const decision = comparison?.decisions.find((item) => item.blockId === block.id) ?? null;
  const options = drillOptions.length > 0 ? drillOptions : buildPracticeDrillOptions(block);

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

      <PracticeBlockEditControls
        block={block}
        options={options}
        onBallCountChange={onBallCountChange}
        onSwapDrill={onSwapDrill}
        onSuggestDrill={onSuggestDrill}
        disabled={isPending}
      />

      <div className="mt-3 rounded-lg border border-dashed bg-muted/20 p-3 text-sm leading-5 text-muted-foreground">
        {decision ? (
          <>
            <p className="font-semibold text-foreground">
              Uploaded result: {decision.result.replace("_", " ")}
            </p>
            <p className="mt-1 font-medium text-foreground">{row.resultNote}</p>
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

function PracticeBlockEditControls({
  block,
  options,
  onBallCountChange,
  onSwapDrill,
  onSuggestDrill,
  disabled,
}: {
  block: PracticeBlock;
  options: PracticeDrillSuggestion[];
  onBallCountChange: (ballCount: number) => void;
  onSwapDrill: (suggestionId: string) => void;
  onSuggestDrill: () => void;
  disabled: boolean;
}) {
  const currentBalls = block.ballCount ?? Math.max(1, Math.round(block.timeMinutes * 1.5));
  const currentOptionId = selectedPracticeDrillOptionId(block, options);
  const nextSuggestion = nextPracticeDrillSuggestion(block, options);

  return (
    <div className="mt-3 rounded-lg border bg-emerald-50/40 p-3 max-lg:border-slate-200 max-lg:bg-[#F2F2F7]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Tune block</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSuggestDrill}
          disabled={disabled || !nextSuggestion}
          className="rounded-lg"
        >
          <RefreshCw className="size-3.5" />
          Suggest drill
        </Button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem]">
        <label className="grid min-w-0 gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Swap drill
          <Select
            value={currentOptionId}
            onValueChange={(value) => {
              if (value) {
                onSwapDrill(value);
              }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 min-w-0 normal-case tracking-normal">
              <SelectValue placeholder="Current custom drill" />
            </SelectTrigger>
            <SelectContent>
              {options.map((suggestion) => (
                <SelectItem key={suggestion.id} value={suggestion.id}>
                  {suggestion.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Balls
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Decrease block balls"
              onClick={() => onBallCountChange(currentBalls - 1)}
              disabled={disabled || currentBalls <= 1}
            >
              <Minus className="size-3.5" />
            </Button>
            <Input
              type="number"
              aria-label="Balls in this practice block"
              min={1}
              max={200}
              inputMode="numeric"
              className="h-9 min-w-0 text-center"
              value={currentBalls}
              onChange={(event) => onBallCountChange(Number(event.target.value))}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Increase block balls"
              onClick={() => onBallCountChange(currentBalls + 1)}
              disabled={disabled || currentBalls >= 200}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
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
  onShowPracticeImage,
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
  onShowPracticeImage: () => void;
  isPending: boolean;
}) {
  const hasImport = Boolean(score || comparison?.sourceSessionId);
  const status = plan.status ?? (savedPlanId ? "planned" : "draft");
  const plannedBalls = plan.totalBalls ?? summary.totalBalls;
  const plannedVolume =
    plan.totalBalls === null ? `${plan.estimatedTimeMinutes} min` : `${plannedBalls} balls`;
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
    <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
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
                <p>
                  Auto-match uses newer uploads. If needed, choose the exact uploaded session near
                  the top.
                </p>
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
              <Button
                onClick={onSave}
                disabled={isPending || Boolean(savedPlanId)}
                className="rounded-lg"
              >
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
            {savedPlanId ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={onShowPracticeImage}
                disabled={isPending}
              >
                <Eye className="size-4" />
                Show PNG
              </Button>
            ) : null}
            {(status === "awaiting_import" || status === "match_found" || status === "analysed") &&
            !hasImport ? (
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
            {(status === "planned" || status === "awaiting_import" || status === "match_found") &&
            !hasImport ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="rounded-lg" disabled={isPending}>
                    Mark abandoned
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Abandon this practice plan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The plan will remain in history, but it will no longer wait for uploaded
                      evidence.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep plan</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onAbandon}>
                      Mark abandoned
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="grid gap-3">
          <ScorecardPanel score={score} summary={summary} />
          <CoachPanel context={context} plan={plan} score={score} />
          <ImportPanel savedPlanId={savedPlanId} hasImport={hasImport} />
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
          {summary.importedBalls}/{summary.totalBalls} planned balls found. {summary.matchedBlocks}/
          {summary.totalBlocks} blocks met planned volume.
        </p>
      </div>
      <div className="rounded-lg border bg-white/70 p-3">
        <p className="text-sm font-semibold">Planned drill score</p>
        {score ? (
          <>
            <p className="mt-2 text-3xl font-semibold tracking-normal">
              {score.score}
              <span className="text-base text-muted-foreground"> / 100</span>
            </p>
            <Progress value={score.score} className="mt-2" />
            <p className="mt-2 text-sm text-muted-foreground">
              Measures how closely the uploaded shots proved this plan; it does not grade the whole
              session. {score.nextAction}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Planned drill score appears after upload.
          </p>
        )}
      </div>
    </div>
  );
}

function PlanVsActual({ comparison }: { comparison: PracticeComparison | null }) {
  return (
    <section className="rounded-xl border bg-white/90 p-3 shadow-sm ring-1 ring-emerald-950/5">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-normal">Plan vs Actual</h3>
          <p className="mt-1 max-w-4xl text-sm leading-5 text-muted-foreground">
            Every block is scored from the matched upload so the review uses the whole page width,
            not the side rail.
          </p>
        </div>
        {comparison?.decisions.length ? (
          <Badge variant="outline" className="w-fit">
            {comparison.decisions.filter((item) => item.actualBalls > 0).length}/
            {comparison.decisions.length} blocks scored
          </Badge>
        ) : null}
      </div>
      {comparison?.decisions.length ? (
        <>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
              Clubs:{" "}
              {comparison.planVsActual.actualClubs.map((club) => club.toUpperCase()).join(", ") ||
                "No clubs"}
            </p>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {comparison.decisions.map((item) => (
              <div key={item.blockId} className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <Badge variant="outline" className={practiceComparisonResultTone(item.result)}>
                    {practiceComparisonResultLabel(item)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Target: {item.target}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">Actual: {item.actual}</p>
                {!item.matchedPlannedVolume && item.actualBalls > 0 ? (
                  <p className="text-xs leading-5 text-amber-900">
                    Volume: {item.actualBalls}/{item.plannedBalls ?? "planned"} planned balls found.
                  </p>
                ) : null}
                <p className="text-xs leading-5 text-muted-foreground">Summary: {item.summary}</p>
              </div>
            ))}
          </div>
          {comparison.whatWorked.length || comparison.needsWork.length ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {comparison.whatWorked.length ? (
                <ResultCallout label="Worked" value={comparison.whatWorked.join(" ")} />
              ) : null}
              {comparison.needsWork.length ? (
                <ResultCallout label="Repeat" value={comparison.needsWork.join(" ")} />
              ) : null}
              <ResultCallout label="Next" value={comparison.nextRecommendation} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Upload the matching launch-monitor session to see whether the practice worked.
        </div>
      )}
    </section>
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
        Upload the next matching Rapsodo session and LM World Tour will score the plan from the shot
        data.
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
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="outline" className="min-h-11 justify-between">
          Templates and saved practice plans
          <Badge variant="secondary">{templates.length + savedPlans.length}</Badge>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="inset-y-0 right-0 left-auto mt-0 h-full w-full max-w-2xl rounded-none">
        <DrawerHeader>
          <DrawerTitle>Templates and saved practice plans</DrawerTitle>
          <DrawerDescription>
            Reuse a plan when you are not building today from the latest data.
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-4 overflow-y-auto px-4 pb-6 lg:grid-cols-2">
          <TemplatesPanel templates={templates} onUseTemplate={onUseTemplate} />
          <SavedPlansPanel plans={savedPlans} onLoad={onLoadSavedPlan} />
        </div>
      </DrawerContent>
    </Drawer>
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
              <Badge
                variant={
                  plan.status === "analysed" || plan.status === "completed" ? "default" : "outline"
                }
              >
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
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-28 normal-case tracking-normal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

function practiceDecisionAction(
  decision: NonNullable<PracticeComparison>["decisions"][number] | null,
) {
  if (!decision || decision.actualBalls === 0) {
    return "Upload matching shots";
  }

  switch (decision.decision) {
    case "maintain":
      return "Move to maintenance";
    case "move_down":
      return "Reduce priority";
    case "repeat_once":
      return "Repeat once";
    case "keep_priority":
      return "Keep priority";
  }
}

function practiceComparisonResultLabel(
  decision: NonNullable<PracticeComparison>["decisions"][number],
) {
  switch (decision.result) {
    case "passed":
      return "Passed";
    case "mixed":
      return "Repeat once";
    case "failed":
      return "Missed target";
    case "insufficient_data":
      return "Low evidence";
  }
}

function practiceComparisonResultTone(
  result: NonNullable<PracticeComparison>["decisions"][number]["result"],
) {
  return cn(
    result === "passed" && "border-emerald-200 bg-emerald-50 text-emerald-800",
    result === "mixed" && "border-amber-200 bg-amber-50 text-amber-900",
    result === "failed" && "border-rose-200 bg-rose-50 text-rose-800",
    result === "insufficient_data" && "border-slate-200 bg-slate-50 text-slate-700",
  );
}

function practicePlanWithEditedBlocks(plan: PracticePlan, blocks: PracticeBlock[]): PracticePlan {
  const resequencedBlocks = blocks.map((blockItem, index) => ({
    ...blockItem,
    order: index + 1,
  }));
  const totalBalls = totalBallsForBlocks(resequencedBlocks);
  const focusClubs = focusClubsForBlocks(resequencedBlocks);
  const focusLabel = focusClubs.map((club) => club.toUpperCase()).join(", ") || "today's priority";

  return {
    ...plan,
    id: undefined,
    status: "draft",
    totalBalls,
    focusClubs,
    title: editedPracticePlanTitle(plan, resequencedBlocks),
    summary:
      totalBalls === null
        ? `${plan.estimatedTimeMinutes}-minute edited session built around ${focusLabel}.`
        : `${totalBalls}-ball edited session built around ${focusLabel}.`,
    blocks: resequencedBlocks,
  };
}

function updatePracticeBlockBalls(block: PracticeBlock, value: number): PracticeBlock {
  const ballCount = normalizeEditedBallCount(value, editablePracticeBlockBalls(block));
  const withVolume = {
    ...block,
    ballCount,
    timeMinutes: estimateBlockMinutes(block, ballCount),
  };

  return retargetPracticeBlock(withVolume, ballCount);
}

function updatePracticeBlockBallsWithinTotal(
  blocks: PracticeBlock[],
  blockId: string,
  value: number,
  targetTotal: number | null,
): PracticeBlock[] {
  const blockIndex = blocks.findIndex((block) => block.id === blockId);

  if (blockIndex < 0) {
    return blocks;
  }

  if (targetTotal === null || blocks.length <= 1) {
    return blocks.map((block) =>
      block.id === blockId ? updatePracticeBlockBalls(block, value) : block,
    );
  }

  const selectedBlock = blocks[blockIndex];
  const otherBlockCount = blocks.length - 1;
  const selectedBallCount = normalizeEditedBallCount(
    value,
    editablePracticeBlockBalls(selectedBlock),
  );
  const maxSelectedBalls = Math.max(1, targetTotal - otherBlockCount);
  const cappedSelectedBalls = Math.min(selectedBallCount, maxSelectedBalls);
  const remainingBalls = Math.max(otherBlockCount, targetTotal - cappedSelectedBalls);
  const otherBlocks = blocks.filter((block) => block.id !== blockId);
  const rebalancedOtherBlocks = redistributePracticeBalls(otherBlocks, remainingBalls);
  let nextOtherIndex = 0;

  return blocks.map((block) => {
    if (block.id === blockId) {
      return updatePracticeBlockBalls(block, cappedSelectedBalls);
    }

    const nextBlock = rebalancedOtherBlocks[nextOtherIndex] ?? block;
    nextOtherIndex += 1;
    return nextBlock;
  });
}

function redistributePracticeBalls(blocks: PracticeBlock[], targetTotal: number): PracticeBlock[] {
  if (blocks.length === 0) {
    return blocks;
  }

  const nextCounts = blocks.map(editablePracticeBlockBalls);
  let delta = targetTotal - nextCounts.reduce((total, count) => total + count, 0);

  while (delta > 0) {
    const targetIndex = indexOfSmallestCount(nextCounts);
    nextCounts[targetIndex] += 1;
    delta -= 1;
  }

  while (delta < 0) {
    const targetIndex = indexOfLargestReducibleCount(nextCounts);

    if (targetIndex < 0) {
      break;
    }

    nextCounts[targetIndex] -= 1;
    delta += 1;
  }

  return blocks.map((block, index) => updatePracticeBlockBalls(block, nextCounts[index] ?? 1));
}

function practicePlanImageDataUrl(plan: PracticePlan) {
  return renderPracticePlanImageCanvas(plan).toDataURL("image/png");
}

function downloadPracticePlanImage(
  dataUrl: string,
  plan: PracticePlan,
  savedPlanId: string | null,
) {
  const anchor = document.createElement("a");
  const datePart = safePracticeImageFilePart(plan.createdAt.slice(0, 10) || "practice");
  const idPart = safePracticeImageFilePart(savedPlanId ?? plan.id ?? "plan");

  anchor.href = dataUrl;
  anchor.download = `lm-world-tour-practice-${datePart}-${idPart}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function renderPracticePlanImageCanvas(plan: PracticePlan) {
  const width = 1200;
  const blockHeight = 178;
  const height = practicePlanImageHeight(plan);
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext("2d");

  if (!context) {
    return canvas;
  }

  context.scale(scale, scale);
  context.textBaseline = "top";
  context.fillStyle = "#f6f4e7";
  context.fillRect(0, 0, width, height);

  drawCanvasRoundRect(context, 32, 32, width - 64, 178, 24, "#0b5130");
  drawCanvasText(context, "LM WORLD TOUR", {
    x: 64,
    y: 60,
    maxWidth: 500,
    lineHeight: 22,
    font: "700 18px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#bde7c4",
  });
  drawCanvasText(context, "Practice reference", {
    x: 64,
    y: 90,
    maxWidth: 500,
    lineHeight: 46,
    font: "700 42px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#ffffff",
  });
  drawCanvasText(context, plan.title, {
    x: 64,
    y: 143,
    maxWidth: 700,
    lineHeight: 26,
    maxLines: 2,
    font: "500 22px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#ecfdf3",
  });

  const plannedVolume =
    plan.totalBalls === null ? `${plan.estimatedTimeMinutes} min` : `${plan.totalBalls} balls`;
  drawCanvasRoundRect(context, 906, 68, 214, 104, 16, "#ffffff1f", "#ffffff55");
  drawCanvasText(context, "PLANNED", {
    x: 932,
    y: 88,
    maxWidth: 160,
    lineHeight: 18,
    font: "700 14px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#d9fbe3",
  });
  drawCanvasText(context, plannedVolume, {
    x: 932,
    y: 112,
    maxWidth: 160,
    lineHeight: 34,
    font: "700 32px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#ffffff",
  });

  const focus = plan.focusClubs.map((club) => club.toUpperCase()).join(", ") || "Practice";
  const metricY = 236;
  const metricWidth = 344;
  drawPracticeImageMetric(
    context,
    "Time",
    `${plan.estimatedTimeMinutes} min`,
    48,
    metricY,
    metricWidth,
  );
  drawPracticeImageMetric(context, "Focus", focus, 428, metricY, metricWidth);
  drawPracticeImageMetric(context, "Status", "Saved plan", 808, metricY, metricWidth);

  let y = 340;
  for (const block of plan.blocks) {
    drawPracticeImageBlock(context, block, y, width - 96, blockHeight - 18);
    y += blockHeight;
  }

  drawCanvasRoundRect(context, 48, height - 76, width - 96, 44, 12, "#e7f4dc", "#b6d4a6");
  drawCanvasText(
    context,
    "After practice: upload the matching Rapsodo or launch-monitor session so scores come from shot data.",
    {
      x: 68,
      y: height - 64,
      maxWidth: width - 136,
      lineHeight: 20,
      maxLines: 1,
      font: "600 16px system-ui, -apple-system, Segoe UI, sans-serif",
      color: "#194d2b",
    },
  );

  return canvas;
}

function practicePlanImageHeight(plan: PracticePlan) {
  return 440 + plan.blocks.length * 178 + 96;
}

function drawPracticeImageMetric(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  drawCanvasRoundRect(context, x, y, width, 70, 14, "#ffffff", "#d7d2bc");
  drawCanvasText(context, label.toUpperCase(), {
    x: x + 20,
    y: y + 14,
    maxWidth: width - 40,
    lineHeight: 16,
    maxLines: 1,
    font: "700 13px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#61715f",
  });
  drawCanvasText(context, value, {
    x: x + 20,
    y: y + 36,
    maxWidth: width - 40,
    lineHeight: 22,
    maxLines: 1,
    font: "700 20px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#11180f",
  });
}

function drawPracticeImageBlock(
  context: CanvasRenderingContext2D,
  block: PracticeBlock,
  y: number,
  width: number,
  height: number,
) {
  const x = 48;
  const balls = block.ballCount === null ? `${block.timeMinutes} min` : `${block.ballCount} balls`;
  const blockLabel = `Block ${block.order} | ${block.type.replace("_", " ")} | ${balls}`;

  drawCanvasRoundRect(context, x, y, width, height, 18, "#ffffff", "#d7d2bc");
  drawCanvasRoundRect(context, x + 18, y + 18, 232, 34, 10, "#e3f4e4", "#b8d9bd");
  drawCanvasText(context, blockLabel, {
    x: x + 34,
    y: y + 25,
    maxWidth: 200,
    lineHeight: 18,
    maxLines: 1,
    font: "700 15px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#15552e",
  });
  drawCanvasText(context, block.title, {
    x: x + 272,
    y: y + 18,
    maxWidth: width - 296,
    lineHeight: 28,
    maxLines: 1,
    font: "700 25px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#11180f",
  });
  drawCanvasText(context, `Clubs: ${formatClubList(block.clubs)}`, {
    x: x + 272,
    y: y + 52,
    maxWidth: width - 296,
    lineHeight: 20,
    maxLines: 1,
    font: "600 16px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#61715f",
  });
  drawCanvasText(context, `Target: ${block.successTarget}`, {
    x: x + 24,
    y: y + 82,
    maxWidth: width - 48,
    lineHeight: 22,
    maxLines: 2,
    font: "600 17px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#194d2b",
  });
  drawCanvasText(context, `How: ${block.drill}`, {
    x: x + 24,
    y: y + 126,
    maxWidth: width - 48,
    lineHeight: 22,
    maxLines: 2,
    font: "500 17px system-ui, -apple-system, Segoe UI, sans-serif",
    color: "#182016",
  });
}

function drawCanvasRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
) {
  const right = x + width;
  const bottom = y + height;

  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();

  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
}

function drawCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  options: CanvasTextOptions,
) {
  const lines = wrapCanvasText(context, text, options);

  context.font = options.font;
  context.fillStyle = options.color;

  lines.forEach((line, index) => {
    context.fillText(line, options.x, options.y + index * options.lineHeight);
  });

  return options.y + lines.length * options.lineHeight;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  options: CanvasTextOptions,
) {
  context.font = options.font;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (context.measureText(candidate).width <= options.maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
    }

    line = word;
  }

  if (line) {
    lines.push(line);
  }

  if (!options.maxLines || lines.length <= options.maxLines) {
    return lines.length > 0 ? lines : [""];
  }

  const visibleLines = lines.slice(0, options.maxLines);
  const lastIndex = visibleLines.length - 1;
  visibleLines[lastIndex] = truncateCanvasText(
    context,
    visibleLines[lastIndex] ?? "",
    options.maxWidth,
  );

  return visibleLines;
}

function truncateCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let nextText = text;

  while (nextText.length > 0 && context.measureText(`${nextText}...`).width > maxWidth) {
    nextText = nextText.slice(0, -1).trimEnd();
  }

  return `${nextText}...`;
}

function safePracticeImageFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "practice"
  );
}

function applyPracticeDrillSuggestion(
  block: PracticeBlock,
  suggestionId: string,
  options: PracticeDrillSuggestion[],
): PracticeBlock {
  const suggestion = options.find((item) => item.id === suggestionId) ?? null;

  if (!suggestion) {
    return block;
  }

  const ballCount = normalizeEditedBallCount(
    editablePracticeBlockBalls(block),
    editablePracticeBlockBalls(block),
  );
  const nextBlock = {
    ...block,
    type: suggestion.type,
    title: suggestion.title,
    clubs: suggestion.clubs ?? block.clubs,
    ballCount,
    timeMinutes: estimateBlockMinutes({ ...block, type: suggestion.type }, ballCount),
    purpose: suggestion.purpose,
    drill: suggestion.drill,
    successTarget: suggestion.successTarget,
    recordPrompt: suggestion.recordPrompt,
    scoringRules: suggestion.scoringRules,
  };

  return retargetPracticeBlock(nextBlock, ballCount);
}

function buildPracticeDrillOptionsByBlock(blocks: PracticeBlock[]): PracticeDrillOptionsByBlock {
  return Object.fromEntries(blocks.map((block) => [block.id, buildPracticeDrillOptions(block)]));
}

function buildPracticeDrillOptions(block: PracticeBlock): PracticeDrillSuggestion[] {
  return [originalPracticeDrillOption(block), ...buildPracticeDrillAlternatives(block).slice(0, 3)];
}

function originalPracticeDrillOption(block: PracticeBlock): PracticeDrillSuggestion {
  return {
    id: "original-agenda",
    label: `Original agenda - ${cleanEditedBlockTitle(block.title)}`,
    source: "original",
    type: block.type,
    title: block.title,
    clubs: block.clubs,
    purpose: block.purpose,
    drill: block.drill,
    successTarget: block.successTarget,
    recordPrompt: block.recordPrompt,
    scoringRules: block.scoringRules,
  };
}

function selectedPracticeDrillOptionId(block: PracticeBlock, options: PracticeDrillSuggestion[]) {
  return options.find((option) => practiceDrillOptionMatchesBlock(option, block))?.id ?? "";
}

function nextPracticeDrillSuggestion(block: PracticeBlock, options: PracticeDrillSuggestion[]) {
  const currentIndex = options.findIndex((option) =>
    practiceDrillOptionMatchesBlock(option, block),
  );
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % options.length : 0;

  return options[nextIndex] ?? null;
}

function practiceDrillOptionMatchesBlock(option: PracticeDrillSuggestion, block: PracticeBlock) {
  return (
    option.type === block.type &&
    normalizeText(cleanEditedBlockTitle(option.title)) ===
      normalizeText(cleanEditedBlockTitle(block.title))
  );
}

function buildPracticeDrillAlternatives(block: PracticeBlock): PracticeDrillSuggestion[] {
  const balls = block.ballCount ?? Math.max(1, Math.round(block.timeMinutes * 1.5));
  const clubs = block.clubs.length > 0 ? block.clubs : ["7i"];
  const primaryClub = clubs[0] ?? "7i";
  const clubLabel = formatClubList(clubs);
  const universal = buildUniversalPracticeDrillAlternatives(block, balls);
  const alternatives: PracticeDrillSuggestion[] = [];

  if (block.type === "warmup" || block.type === "warmup_round") {
    alternatives.push(
      playableSuggestion({
        id: "warmup-tempo-ladder",
        label: "Tempo ladder",
        type: "warmup",
        title: "Tempo ladder warm-up",
        clubs,
        balls,
        targetRate: 0.75,
        purpose: "Find rhythm and strike before the scored blocks.",
        drill: `Move from half-speed wedges to stock ${formatClubCode(primaryClub)} swings. Call playable before checking the result.`,
        recordPrompt: "Playable count, tempo feel, and first repeated strike miss.",
      }),
      playableSuggestion({
        id: "warmup-contact-map",
        label: "Contact map",
        type: "warmup",
        title: "Contact map",
        clubs,
        balls,
        targetRate: 0.7,
        purpose: "See whether strike location is ready before chasing direction.",
        drill: `Rotate ${clubLabel}. Mark strike, start line, and whether the ball would stay in play.`,
        recordPrompt: "Strike location, playable count, and any heavy or thin pattern.",
      }),
    );
  }

  if (block.type === "baseline") {
    alternatives.push(
      baselineSuggestion({
        id: "baseline-stock-check",
        label: "Stock check",
        title: "Baseline check",
        clubs,
        balls,
        purpose: "Check whether today matches the latest data before changing anything.",
        drill: `Alternate ${clubLabel}. Normal stock swings only.`,
        recordPrompt: "Start line, carry miss, and whether the pattern matches the last import.",
      }),
      playableSuggestion({
        id: "baseline-dispersion-scan",
        label: "Dispersion scan",
        type: "baseline",
        title: "Dispersion scan",
        clubs,
        balls,
        targetRate: 0.65,
        purpose: "Find the day's biggest miss before the priority work.",
        drill: `Hit one ball with each club in order: ${clubLabel}. Score playable and note the first big miss.`,
        recordPrompt: "Playable count, big miss direction, and carry feel.",
      }),
    );
  }

  if (block.type === "scoring" || block.type === "short_game") {
    alternatives.push(
      scoringSuggestion({
        id: "scoring-wedge-ladder",
        label: "Wedge ladder",
        title: `${formatClubCode(primaryClub)} wedge ladder`,
        clubs,
        balls,
        targetRate: 0.65,
        purpose: "Turn the scoring-zone opportunity into measured carry control.",
        drill: `Split the block between full, three-quarter and half ${formatClubCode(primaryClub)} shots.`,
        recordPrompt: "Carry, offline, and whether the shot was full, three-quarter, or half.",
      }),
      scoringSuggestion({
        id: "scoring-random-windows",
        label: "Random windows",
        title: "Random wedge windows",
        clubs,
        balls,
        targetRate: 0.6,
        purpose: "Make scoring practice less grooved and more course-like.",
        drill: `Change distance or flight every ball with ${clubLabel}. Do not repeat the same shot twice.`,
        recordPrompt: "Target window, carry result, and whether distance control held up.",
      }),
      playableSuggestion({
        id: "scoring-up-and-down",
        label: "Up-and-down",
        type: "short_game",
        title: "Up-and-down rehearsal",
        clubs,
        balls,
        targetRate: 0.6,
        purpose: "Move the block toward one-ball scoring decisions.",
        drill:
          "Play each ball as a new short-game problem. Change lie, landing spot, or trajectory every rep.",
        recordPrompt: "Up-and-down result, landing spot, and miss pattern.",
      }),
    );
  }

  if (block.type === "putting") {
    alternatives.push(
      puttingSuggestion({
        id: "putting-start-gate",
        label: "Start gate",
        title: "Putting start gate",
        balls,
        targetRate: 0.7,
        purpose: "Clean up start line before moving into distance control.",
        drill: "Set a start gate and roll sets of three from the same face alignment.",
        recordPrompt: "Gate hits, pushes, pulls, and speed notes.",
      }),
      puttingSuggestion({
        id: "putting-pace-ladder",
        label: "Pace ladder",
        title: "Pace ladder",
        balls,
        targetRate: 0.65,
        purpose: "Make lag putting measurable without turning it into mechanics.",
        drill: "Roll balls to three distances and score finishes inside the intended pace zone.",
        recordPrompt: "Distance, leave distance, and short or long bias.",
      }),
    );
  }

  if (block.type === "speed") {
    alternatives.push(
      playableSuggestion({
        id: "speed-controlled-ladder",
        label: "Controlled speed",
        type: "speed",
        title: "Controlled speed ladder",
        clubs,
        balls,
        targetRate: 0.7,
        purpose: "Build speed without losing strike or start line.",
        drill: "Move from 80% to 90% to full intent, only stepping up after playable contact.",
        recordPrompt: "Club speed, playable strike, and where speed started leaking.",
      }),
      playableSuggestion({
        id: "speed-sequence-reset",
        label: "Sequence reset",
        type: "speed",
        title: "Sequence reset",
        clubs,
        balls,
        targetRate: 0.65,
        purpose: "Keep speed work athletic without chasing one-off numbers.",
        drill:
          "Alternate a rehearsal swing with one measured swing. Stop after any two poor strikes in a row.",
        recordPrompt: "Peak speed, average speed, and strike quality.",
      }),
    );
  }

  if (block.type === "random" || block.type === "test") {
    alternatives.push(
      pointsSuggestion({
        id: "random-scoring-finish",
        label: "Random finish",
        title: "Randomised scoring finish",
        clubs,
        balls,
        purpose: "Transfer the range work into one-ball course decisions.",
        drill: `Random club every ball: ${clubLabel}. One routine, one shot, then change club.`,
        recordPrompt: "One point for playable, one bonus for target corridor.",
      }),
      playableSuggestion({
        id: "random-fairway-green",
        label: "Fairway or green",
        type: "random",
        title: "Fairway or green challenge",
        clubs,
        balls,
        targetRate: 0.65,
        purpose: "Pressure-test the plan against course-style targets.",
        drill: `Call fairway or green before each shot with ${clubLabel}. Full reset between balls.`,
        recordPrompt: "Target call, playable result, and decision quality.",
      }),
    );
  }

  const driverLike = block.clubs.some((club) => normalizeText(club).includes("driver"));

  alternatives.push(
    corridorSuggestion({
      id: "technical-start-line",
      label: "Start-line gate",
      title: `${technicalTitlePrefix(block)} ${driverLike ? "delivery" : "start line"}`,
      clubs,
      balls,
      targetRate: 0.6,
      maxMissRate: 0.12,
      purpose: block.purpose,
      drill: driverLike
        ? "Neutral delivery window. Track path and face-to-path, but only score playable shots."
        : "Start-line gate. Pick a clear start window and hit stock swings only.",
      recordPrompt: "Corridor hits, big misses, and one miss pattern note.",
    }),
    playableSuggestion({
      id: "technical-strike-ladder",
      label: "Strike ladder",
      type: "technical",
      title: `${technicalTitlePrefix(block)} strike ladder`,
      clubs,
      balls,
      targetRate: 0.7,
      purpose: "Prioritise centred contact before judging the flight.",
      drill: `Hit ${formatClubCode(primaryClub)} in small sets. Move on only after two playable strikes in a row.`,
      recordPrompt: "Strike quality, playable count, and the first miss after a good pair.",
    }),
    corridorSuggestion({
      id: "technical-pressure-corridor",
      label: "Pressure corridor",
      title: `${technicalTitlePrefix(block)} pressure corridor`,
      clubs,
      balls,
      targetRate: 0.55,
      maxMissRate: 0.15,
      purpose: "Make the same priority measurable under a little pressure.",
      drill: `Every miss restarts the mini-set. Complete three clean reps with ${formatClubCode(primaryClub)} before changing target.`,
      recordPrompt: "Clean sets, big misses, and the miss that broke the set.",
    }),
  );

  const mixedAlternatives = [...alternatives.slice(0, 2), ...universal, ...alternatives.slice(2)];

  return uniquePracticeDrillAlternatives(block, mixedAlternatives).slice(0, 3);
}

function buildUniversalPracticeDrillAlternatives(
  block: PracticeBlock,
  balls: number,
): PracticeDrillSuggestion[] {
  return [
    corridorSuggestion({
      id: "alt-7i-start-gate",
      label: "7I start gate",
      title: "7I start-line gate",
      clubs: ["7i"],
      balls,
      targetRate: 0.62,
      maxMissRate: 0.12,
      purpose: "Use a neutral mid-iron to check whether start line is the real issue today.",
      drill:
        "Pick a tight start window with 7I. Reset after every ball and ignore distance unless strike collapses.",
      recordPrompt: "Start-line hits, big misses, and whether contact stayed neutral.",
    }),
    playableSuggestion({
      id: "alt-driver-fairway-finder",
      label: "Driver finder",
      type: "technical",
      title: "Driver fairway finder",
      clubs: ["driver"],
      balls,
      targetRate: 0.65,
      purpose: "Pressure-test tee-shot safety without letting speed dominate the session.",
      drill:
        "Hit driver to a fairway-width target. Score only playable starts and stop after two penalty misses.",
      recordPrompt: "Playable starts, penalty misses, and the safest tee-shot feel.",
    }),
    scoringSuggestion({
      id: "alt-wedge-distance-windows",
      label: "Wedge windows",
      title: "SW distance windows",
      clubs: ["sw", "gw", "pw"],
      balls,
      targetRate: 0.65,
      purpose: "Move the block into scoring control with different clubs and shorter targets.",
      drill: "Rotate SW, GW and PW through three carry windows. Change target every shot.",
      recordPrompt: "Carry window, miss side, and whether distance control tightened.",
    }),
    pointsSuggestion({
      id: "alt-nine-shot-course-test",
      label: "Course test",
      title: "Nine-shot course test",
      clubs: ["driver", "7i", "sw", "putter"],
      balls,
      purpose: "Check whether the session transfers into one-ball course decisions.",
      drill: "Play tee shot, approach, wedge and putt patterns as if each ball starts a new hole.",
      recordPrompt: "One point for playable, one bonus for choosing the right shot.",
    }),
  ];
}

function uniquePracticeDrillAlternatives(
  original: PracticeBlock,
  alternatives: PracticeDrillSuggestion[],
) {
  const seen = new Set([practiceDrillIdentity(original)]);

  return alternatives.filter((alternative) => {
    const identity = practiceDrillIdentity(alternative);

    if (seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
}

function practiceDrillIdentity(drill: Pick<PracticeBlock, "type" | "title">) {
  return `${drill.type}:${normalizeText(cleanEditedBlockTitle(drill.title))}`;
}

function playableSuggestion({
  id,
  label,
  type,
  title,
  clubs,
  balls,
  targetRate,
  purpose,
  drill,
  recordPrompt,
}: {
  id: string;
  label: string;
  type: PracticeBlock["type"];
  title: string;
  clubs: string[];
  balls: number;
  targetRate: number;
  purpose: string;
  drill: string;
  recordPrompt: string;
}): PracticeDrillSuggestion {
  const target = Math.max(1, Math.ceil(balls * targetRate));

  return {
    id,
    label,
    source: "alternative",
    type,
    title,
    clubs,
    purpose,
    drill,
    successTarget: `${target} of ${balls} playable.`,
    recordPrompt,
    scoringRules: {
      metric: "playable",
      target,
    },
  };
}

function baselineSuggestion({
  id,
  label,
  title,
  clubs,
  balls,
  purpose,
  drill,
  recordPrompt,
}: {
  id: string;
  label: string;
  title: string;
  clubs: string[];
  balls: number;
  purpose: string;
  drill: string;
  recordPrompt: string;
}): PracticeDrillSuggestion {
  const target = Math.max(1, Math.ceil(balls * 0.6));

  return {
    id,
    label,
    source: "alternative",
    type: "baseline",
    title,
    clubs,
    purpose,
    drill,
    successTarget: `${target} playable or inside carry target.`,
    recordPrompt,
    scoringRules: {
      metric: "baseline",
      target,
    },
  };
}

function corridorSuggestion({
  id,
  label,
  title,
  clubs,
  balls,
  targetRate,
  maxMissRate,
  purpose,
  drill,
  recordPrompt,
}: {
  id: string;
  label: string;
  title: string;
  clubs: string[];
  balls: number;
  targetRate: number;
  maxMissRate: number;
  purpose: string;
  drill: string;
  recordPrompt: string;
}): PracticeDrillSuggestion {
  const target = Math.max(1, Math.ceil(balls * targetRate));
  const maxBigMisses = Math.max(1, Math.floor(balls * maxMissRate));

  return {
    id,
    label,
    source: "alternative",
    type: "technical",
    title,
    clubs,
    purpose,
    drill,
    successTarget: `${target} of ${balls} start inside the corridor. No more than ${maxBigMisses} big misses.`,
    recordPrompt,
    scoringRules: {
      metric: "corridor",
      target,
      maxBigMisses,
    },
  };
}

function scoringSuggestion({
  id,
  label,
  title,
  clubs,
  balls,
  targetRate,
  purpose,
  drill,
  recordPrompt,
}: {
  id: string;
  label: string;
  title: string;
  clubs: string[];
  balls: number;
  targetRate: number;
  purpose: string;
  drill: string;
  recordPrompt: string;
}): PracticeDrillSuggestion {
  const target = Math.max(1, Math.ceil(balls * targetRate));

  return {
    id,
    label,
    source: "alternative",
    type: "scoring",
    title,
    clubs,
    purpose,
    drill,
    successTarget: `${target} of ${balls} finish inside the carry window.`,
    recordPrompt,
    scoringRules: {
      metric: "carry_ladder",
      target,
    },
  };
}

function puttingSuggestion({
  id,
  label,
  title,
  balls,
  targetRate,
  purpose,
  drill,
  recordPrompt,
}: {
  id: string;
  label: string;
  title: string;
  balls: number;
  targetRate: number;
  purpose: string;
  drill: string;
  recordPrompt: string;
}): PracticeDrillSuggestion {
  const target = Math.max(1, Math.ceil(balls * targetRate));

  return {
    id,
    label,
    source: "alternative",
    type: "putting",
    title,
    clubs: ["putter"],
    purpose,
    drill,
    successTarget: `${target} of ${balls} finish inside the target zone.`,
    recordPrompt,
    scoringRules: {
      metric: "putting",
      target,
    },
  };
}

function pointsSuggestion({
  id,
  label,
  title,
  clubs,
  balls,
  purpose,
  drill,
  recordPrompt,
}: {
  id: string;
  label: string;
  title: string;
  clubs: string[];
  balls: number;
  purpose: string;
  drill: string;
  recordPrompt: string;
}): PracticeDrillSuggestion {
  const target = Math.max(1, Math.round(balls * 1.35));

  return {
    id,
    label,
    source: "alternative",
    type: "random",
    title,
    clubs,
    purpose,
    drill,
    successTarget: `${target}+ points from ${balls * 2} possible.`,
    recordPrompt,
    scoringRules: {
      metric: "points",
      target,
    },
  };
}

function retargetPracticeBlock(block: PracticeBlock, balls: number): PracticeBlock {
  const metric = block.scoringRules.metric;

  if (metric === "points") {
    const target = Math.max(1, Math.round(balls * 1.35));

    return {
      ...block,
      successTarget: `${target}+ points from ${balls * 2} possible.`,
      scoringRules: { ...block.scoringRules, target },
    };
  }

  if (metric === "carry_ladder") {
    const target = Math.max(1, Math.ceil(balls * 0.65));

    return {
      ...block,
      successTarget: `${target} of ${balls} finish inside the carry window.`,
      scoringRules: { ...block.scoringRules, target },
    };
  }

  if (metric === "corridor") {
    const target = Math.max(1, Math.ceil(balls * 0.6));
    const maxBigMisses = Math.max(1, Math.floor(balls * 0.12));

    return {
      ...block,
      successTarget: `${target} of ${balls} start inside the corridor. No more than ${maxBigMisses} big misses.`,
      scoringRules: { ...block.scoringRules, target, maxBigMisses },
    };
  }

  if (metric === "baseline") {
    const target = Math.max(1, Math.ceil(balls * 0.6));

    return {
      ...block,
      successTarget: `${target} playable or inside carry target.`,
      scoringRules: { ...block.scoringRules, target },
    };
  }

  if (metric === "putting") {
    const target = Math.max(1, Math.ceil(balls * 0.7));

    return {
      ...block,
      successTarget: `${target} of ${balls} finish inside the target zone.`,
      scoringRules: { ...block.scoringRules, target },
    };
  }

  const targetRate = block.type === "warmup" || block.type === "warmup_round" ? 0.75 : 0.7;
  const target = Math.max(1, Math.ceil(balls * targetRate));

  return {
    ...block,
    successTarget: `${target} of ${balls} playable.`,
    scoringRules: { ...block.scoringRules, target },
  };
}

function editedPracticePlanTitle(plan: PracticePlan, blocks: PracticeBlock[]) {
  const mainBlock =
    blocks.find((block) => /main priority/i.test(block.title)) ??
    blocks.find((block) => block.type === "technical") ??
    blocks.find((block) => block.type !== "warmup" && block.type !== "warmup_round") ??
    blocks[0] ??
    null;

  return mainBlock ? cleanEditedBlockTitle(mainBlock.title) : plan.title;
}

function totalBallsForBlocks(blocks: PracticeBlock[]) {
  if (blocks.some((block) => block.ballCount === null)) {
    return null;
  }

  return blocks.reduce((total, block) => total + (block.ballCount ?? 0), 0);
}

function focusClubsForBlocks(blocks: PracticeBlock[]) {
  const seen = new Set<string>();
  const clubs: string[] = [];
  const orderedBlocks = [
    ...blocks.filter(
      (block) =>
        block.type !== "warmup" && block.type !== "warmup_round" && block.type !== "baseline",
    ),
    ...blocks.filter((block) => block.type === "baseline"),
    ...blocks.filter((block) => block.type === "warmup" || block.type === "warmup_round"),
  ];

  for (const block of orderedBlocks) {
    for (const club of block.clubs) {
      const normalized = normalizeText(club);

      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      clubs.push(club);
    }
  }

  return clubs.slice(0, 6);
}

function estimateBlockMinutes(block: PracticeBlock, balls: number) {
  if (block.type === "warmup" || block.type === "warmup_round") {
    return Math.max(5, Math.round(balls * 0.6));
  }

  if (block.type === "random" || block.type === "test") {
    return Math.max(5, Math.round(balls * 0.8));
  }

  if (block.type === "putting" || block.type === "short_game") {
    return Math.max(5, Math.round(balls * 0.65));
  }

  return Math.max(5, Math.round(balls * 0.5));
}

function editablePracticeBlockBalls(block: PracticeBlock) {
  return block.ballCount ?? Math.max(1, Math.round(block.timeMinutes * 1.5));
}

function indexOfSmallestCount(counts: number[]) {
  return counts.reduce(
    (lowestIndex, count, index) => (count < counts[lowestIndex] ? index : lowestIndex),
    0,
  );
}

function indexOfLargestReducibleCount(counts: number[]) {
  return counts.reduce((largestIndex, count, index) => {
    if (count <= 1) {
      return largestIndex;
    }

    if (largestIndex < 0 || count > counts[largestIndex]) {
      return index;
    }

    return largestIndex;
  }, -1);
}

function normalizeEditedBallCount(value: number, fallback: number) {
  const nextValue = Number.isFinite(value) ? Math.round(value) : fallback;

  return Math.min(200, Math.max(1, nextValue));
}

function technicalTitlePrefix(block: PracticeBlock) {
  const title = cleanEditedBlockTitle(block.title);
  const titleBase = title
    .replace(/\s+(start line|delivery|strike ladder|pressure corridor)$/i, "")
    .trim();

  if (
    titleBase &&
    !/^main priority$/i.test(titleBase) &&
    !/^secondary priority$/i.test(titleBase)
  ) {
    return titleBase;
  }

  return block.clubs[0] ? formatClubCode(block.clubs[0]) : "Priority";
}

function cleanEditedBlockTitle(title: string) {
  return title
    .replace(/^main priority:\s*/i, "")
    .replace(/^secondary priority:\s*/i, "")
    .trim();
}

function formatClubList(clubs: string[]) {
  return clubs.map(formatClubCode).join(", ") || "the selected club";
}

function formatClubCode(club: string) {
  return club.toUpperCase();
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
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
