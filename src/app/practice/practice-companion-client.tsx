"use client";

import { useMobileActivity } from "@/components/app/use-mobile-activity";
import { MobileLargeTitle } from "@/components/app/mobile-screen";

import Link from "next/link";
import dynamic from "next/dynamic";
import { clubLabel, clubSummary, blockVolume } from "./practice-mobile-format";
import { lazy, Suspense, useEffect, useRef, useState, useTransition } from "react";

const loadActiveRangeMode = () =>
  import("./active-range-mode").then((module) => ({ default: module.ActiveRangeMode }));
const ActiveRangeMode = lazy(loadActiveRangeMode);
import { CheckCircle2, ChevronRight, Save } from "lucide-react";

import {
  completePracticeActivityAction,
  generatePracticePlanAction,
  savePracticeActivityProgressAction,
  saveAndStartPracticePlanAction,
  startPracticePlanAction,
} from "@/app/practice/actions";
import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSSectionHeader,
} from "@/components/app/ios-mobile";
import {
  MobileCarouselPagination,
  MobileFilterChipGroup,
  MobileSegmentedControl,
} from "@/components/app/mobile-controls";
import { OperationStatus } from "@/components/app/operation-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import type {
  GeneratePracticePlanOptions,
  PracticeBlock,
  PracticeEnergyLevel,
  PracticeFacilityOptions,
  PracticeIntent,
  PracticePlan,
  PracticePlannerContext,
  SavedPracticePlan,
} from "@/lib/practice-planner";
import { formatClubType } from "@/lib/club-format";
import { cn } from "@/lib/utils";

const MeasuredPracticeResultCard = dynamic(() =>
  import("./measured-practice-result-card").then((module) => module.MeasuredPracticeResultCard),
);

type MeasuredResult = SavedPracticePlan["result"];

type Props = {
  accountId: string;
  context: PracticePlannerContext;
  initialPlan: PracticePlan;
  initialOptions: GeneratePracticePlanOptions;
  measuredResult: MeasuredResult;
};

const timeOptions = [20, 30, 45, 60] as const;
const energyOptions: Array<{ value: PracticeEnergyLevel; label: string }> = [
  { value: "fresh", label: "Fresh" },
  { value: "normal", label: "Normal" },
  { value: "tired", label: "Tired" },
  { value: "niggle", label: "Managing a niggle" },
];
const intentOptions: Array<{ value: PracticeIntent; label: string }> = [
  { value: "scoring", label: "Recommended" },
  { value: "latest_weakness", label: "Latest weakness" },
  { value: "confidence", label: "Build confidence" },
  { value: "round_preparation", label: "Round preparation" },
  { value: "distance_mapping", label: "Map distances" },
  { value: "speed", label: "Speed" },
];
const facilityOptions: Array<{ key: keyof PracticeFacilityOptions; label: string }> = [
  { key: "golfClubOnly", label: "Range" },
  { key: "chippingGreen", label: "Short-game area" },
  { key: "puttingGreen", label: "Putting green" },
  { key: "bunker", label: "Practice bunker" },
];

export function PracticeCompanionClient({
  accountId,
  context,
  initialPlan,
  initialOptions,
  measuredResult,
}: Props) {
  const [options, setOptions] = useState(initialOptions);
  const [plan, setPlan] = useState(() =>
    initialPlan.id ? initialPlan : compactCompanionPlan(initialPlan),
  );
  const [savedPlanId, setSavedPlanId] = useState(initialPlan.id ?? null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [completedBlockIds, setCompletedBlockIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [remainingBalls, setRemainingBalls] = useState<Record<string, number>>({});
  const [rangeMode, setRangeMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activityStarted, setActivityStarted] = useState(false);
  const startRequired = useRef(false);
  const [finished, setFinished] = useState(false);
  const [routeDirection, setRouteDirection] = useState<"forward" | "back" | null>(null);
  const [blockDirection, setBlockDirection] = useState<"forward" | "back" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [blockCarouselApi, setBlockCarouselApi] = useState<CarouselApi>();
  const [isPending, startTransition] = useTransition();
  const selectedBlock = plan.blocks[selectedIndex] ?? plan.blocks[0] ?? null;
  const activeMeasuredResult =
    plan.id && plan.id === initialPlan.id && plan.status === "analysed" ? measuredResult : null;

  useEffect(() => {
    if (!savedPlanId || initialPlan.status === "analysed") return;
    // Prepare the immersive screen while connected, before an offline Resume tap.
    const prepareRangeMode = () => {
      if (navigator.onLine) void loadActiveRangeMode().catch(() => undefined);
    };
    prepareRangeMode();
    window.addEventListener("online", prepareRangeMode);
    return () => window.removeEventListener("online", prepareRangeMode);
  }, [savedPlanId, initialPlan.status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cached = readActivePractice(accountId);
      if (initialPlan.status === "analysed") {
        if (cached?.planId === initialPlan.id) clearActivePractice(accountId);
      } else if (cached && cached.planId === initialPlan.id) {
        const blockIds = new Set(initialPlan.blocks.map((block) => block.id));
        setCompletedBlockIds(cached.completedBlockIds.filter((id) => blockIds.has(id)));
        setNote(cached.note);
        setRemainingBalls(cached.remainingBalls ?? {});
        setSelectedIndex(Math.min(cached.blockIndex, Math.max(0, initialPlan.blocks.length - 1)));
        setFinished(cached.finished ?? false);
        setPaused(cached.paused ?? false);
        setRangeMode(!cached.finished && !cached.paused);
        setActivityStarted(true);
        startRequired.current = initialPlan.status === "planned";
      } else if (initialPlan.activityProgress) {
        const progress = initialPlan.activityProgress;
        const blockIds = new Set(initialPlan.blocks.map((block) => block.id));
        setCompletedBlockIds(progress.completedBlockIds.filter((id) => blockIds.has(id)));
        setNote(progress.note);
        setSelectedIndex(Math.min(progress.blockIndex, Math.max(0, initialPlan.blocks.length - 1)));
        setPaused(true);
        // Showing saved server progress is read-only until Resume is chosen.
      }
      // One state batch restores the activity before enabling any persistence effect.
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    accountId,
    initialPlan.id,
    initialPlan.status,
    initialPlan.blocks,
    initialPlan.activityProgress,
  ]);

  useEffect(() => {
    if (!blockCarouselApi) return;
    const syncSelectedBlock = () => setSelectedIndex(blockCarouselApi.selectedScrollSnap());
    blockCarouselApi.on("select", syncSelectedBlock);
    blockCarouselApi.on("reInit", syncSelectedBlock);
    return () => {
      blockCarouselApi.off("select", syncSelectedBlock);
      blockCarouselApi.off("reInit", syncSelectedBlock);
    };
  }, [blockCarouselApi]);

  useEffect(() => {
    if (!blockCarouselApi || blockCarouselApi.selectedScrollSnap() === selectedIndex) return;
    blockCarouselApi.scrollTo(selectedIndex);
  }, [blockCarouselApi, selectedIndex]);

  useMobileActivity(rangeMode);

  const syncSnapshot = useRef({
    savedPlanId,
    selectedIndex,
    completedBlockIds,
    note,
    plan,
    finished,
  });
  const syncing = useRef(false);
  const lastSynced = useRef("");
  useEffect(() => {
    syncSnapshot.current = { savedPlanId, selectedIndex, completedBlockIds, note, plan, finished };
  }, [savedPlanId, selectedIndex, completedBlockIds, note, plan, finished]);

  useEffect(() => {
    if (!hydrated || !activityStarted || !savedPlanId || plan.status === "analysed") return;
    cacheActivePractice(
      accountId,
      savedPlanId,
      completedBlockIds,
      note,
      selectedIndex,
      plan,
      finished,
      remainingBalls,
      paused,
    );
    let cancelled = false;
    async function sync() {
      if (syncing.current || !navigator.onLine) return;
      const current = syncSnapshot.current;
      if (!current.savedPlanId) return;
      const signature = JSON.stringify([
        current.savedPlanId,
        current.selectedIndex,
        current.completedBlockIds,
        current.note,
        current.finished,
      ]);
      if (signature === lastSynced.current) return;
      syncing.current = true;
      try {
        if (startRequired.current) {
          await startPracticePlanAction(current.savedPlanId);
          if (syncSnapshot.current.savedPlanId === current.savedPlanId)
            startRequired.current = false;
        }
        await savePracticeActivityProgressAction(current.savedPlanId, {
          blockIndex: current.selectedIndex,
          completedBlockIds: current.completedBlockIds,
          note: current.note,
        });
        if (current.finished) await completePracticeActivityAction(current.savedPlanId);
        lastSynced.current = signature;
        if (!cancelled)
          setMessage(
            current.finished ? "Activity saved. Import shots to measure the result." : null,
          );
      } catch {
        if (!cancelled) setMessage("Saved on this iPhone. Reconnect to sync practice.");
      } finally {
        syncing.current = false;
      }
    }
    const timer = window.setTimeout(() => void sync(), 650);
    const retry = window.setInterval(() => void sync(), 15000);
    const online = () => void sync();
    window.addEventListener("online", online);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(retry);
      window.removeEventListener("online", online);
    };
  }, [
    accountId,
    hydrated,
    activityStarted,
    paused,
    completedBlockIds,
    note,
    savedPlanId,
    selectedIndex,
    plan,
    finished,
    remainingBalls,
  ]);

  function regenerate(nextOptions = options) {
    setMessage(null);
    startTransition(async () => {
      try {
        const generated = await generatePracticePlanAction(nextOptions);
        setOptions(nextOptions);
        setPlan(compactCompanionPlan(generated));
        setSavedPlanId(null);
        setActivityStarted(false);
        startRequired.current = false;
        setSelectedIndex(0);
        setCompletedBlockIds([]);
        setRemainingBalls({});
        setFinished(false);
      } catch {
        setMessage("Could not update the plan. Your previous practice is still available.");
      }
    });
  }

  function saveAndStart() {
    setMessage(null);
    startTransition(async () => {
      try {
        const { planId } = await saveAndStartPracticePlanAction(plan);
        setSavedPlanId(planId);
        setActivityStarted(true);
        startRequired.current = false;
        setPlan((current) => ({ ...current, id: planId, status: "awaiting_import" }));
        setRouteDirection("forward");
        setBlockDirection(null);
        setRangeMode(true);
        setPaused(false);
        setFinished(false);
        setCompletedBlockIds([]);
        setSelectedIndex(0);
        setRemainingBalls({});
        setNote("");
        cacheActivePractice(
          accountId,
          planId,
          [],
          "",
          0,
          { ...plan, id: planId, status: "awaiting_import" },
          false,
          {},
          false,
        );
        setMessage(null);
      } catch {
        setMessage("Connect to save this new plan, then try Start again.");
      }
    });
  }

  function resume() {
    if (!savedPlanId || finished) return;
    // Reopen cached activity immediately; network latency must not block range controls.
    startRequired.current = plan.status === "planned";
    setRouteDirection("forward");
    setBlockDirection(null);
    setRangeMode(true);
    setPaused(false);
    setFinished(false);
    setActivityStarted(true);
    cacheActivePractice(
      accountId,
      savedPlanId,
      completedBlockIds,
      note,
      selectedIndex,
      plan,
      false,
      remainingBalls,
      false,
    );
  }

  function completeBlock() {
    if (!selectedBlock) return;
    const complete = completedBlockIds.includes(selectedBlock.id)
      ? completedBlockIds
      : [...completedBlockIds, selectedBlock.id];
    const nextIndex = Math.min(selectedIndex + 1, plan.blocks.length - 1);
    setCompletedBlockIds(complete);
    if (nextIndex !== selectedIndex) setBlockDirection("forward");
    setSelectedIndex(nextIndex);
    if (savedPlanId) cacheActivePractice(accountId, savedPlanId, complete, note, nextIndex);
  }

  function finishWithoutUpload() {
    if (!savedPlanId) return;
    setRouteDirection("back");
    setRangeMode(false);
    setPaused(false);
    setFinished(true);
    setPlan((current) => ({ ...current, status: "completed" }));
    cacheActivePractice(
      accountId,
      savedPlanId,
      completedBlockIds,
      note,
      selectedIndex,
      plan,
      true,
      remainingBalls,
      false,
    );
    setMessage("Activity complete. Import shots to measure the result.");
  }

  if (rangeMode) {
    return (
      <div
        key="range-mode"
        className={cn(routeDirection && "t-route-step")}
        data-direction={routeDirection ?? undefined}
      >
        <Suspense
          fallback={
            <p role="status" className="py-6">
              Opening Range Mode…
            </p>
          }
        >
          <ActiveRangeMode
            plan={plan}
            block={selectedBlock}
            blockIndex={selectedIndex}
            blockDirection={blockDirection}
            completedBlockIds={completedBlockIds}
            note={note}
            remainingBalls={
              selectedBlock ? (remainingBalls[selectedBlock.id] ?? selectedBlock.ballCount ?? 0) : 0
            }
            onRemainingBalls={(count) => {
              if (selectedBlock) {
                const next = { ...remainingBalls, [selectedBlock.id]: count };
                setRemainingBalls(next);
                if (savedPlanId)
                  cacheActivePractice(
                    accountId,
                    savedPlanId,
                    completedBlockIds,
                    note,
                    selectedIndex,
                    plan,
                    finished,
                    next,
                    paused,
                  );
              }
            }}
            pending={isPending}
            onNote={(value) => {
              setNote(value);
              if (savedPlanId)
                cacheActivePractice(
                  accountId,
                  savedPlanId,
                  completedBlockIds,
                  value,
                  selectedIndex,
                );
            }}
            onPrevious={() => {
              setBlockDirection("back");
              const next = Math.max(0, selectedIndex - 1);
              setSelectedIndex(next);
              if (savedPlanId)
                cacheActivePractice(accountId, savedPlanId, completedBlockIds, note, next);
            }}
            onNext={() => {
              setBlockDirection("forward");
              const next = Math.min(plan.blocks.length - 1, selectedIndex + 1);
              setSelectedIndex(next);
              if (savedPlanId)
                cacheActivePractice(accountId, savedPlanId, completedBlockIds, note, next);
            }}
            onComplete={completeBlock}
            onPause={() => {
              setRouteDirection("back");
              setRangeMode(false);
              setPaused(true);
              if (savedPlanId)
                cacheActivePractice(
                  accountId,
                  savedPlanId,
                  completedBlockIds,
                  note,
                  selectedIndex,
                  plan,
                  finished,
                  remainingBalls,
                  true,
                );
            }}
            onFinish={finishWithoutUpload}
            practicePlanId={savedPlanId}
            status={message}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div
      key="practice-plan"
      className={cn("grid gap-4", routeDirection && "t-route-step")}
      data-direction={routeDirection ?? undefined}
    >
      <MobileLargeTitle title="Practice" detail="Make your next session count." />
      {activeMeasuredResult ? (
        <MeasuredPracticeResultCard result={activeMeasuredResult} blocks={plan.blocks} />
      ) : null}
      {options.intent === "speed" || options.sessionType === "speed" ? (
        <SpeedDevelopmentCompanionReadout context={context} />
      ) : null}
      {finished ? <FinishedActions message={message} planId={savedPlanId} /> : null}
      <Card className="relative isolate gap-3 overflow-hidden py-3" data-current-practice-plan>
        <CardHeader>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {activeMeasuredResult || finished ? "Completed practice" : "Recommended session"}
            </p>
            <CardTitle className="mt-1 text-xl font-bold leading-6 tracking-tight">
              {plan.title}
            </CardTitle>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
              {plan.why[0] ?? plan.summary}
            </p>
          </div>
          <CardAction>
            <Badge variant="secondary">
              {activeMeasuredResult ? "Measured" : plan.confidenceLabel}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-semibold text-foreground" aria-label="Plan summary">
            {plan.totalBalls === null ? "Time based" : `${plan.totalBalls} balls`} ·{" "}
            {plan.estimatedTimeMinutes} min · {clubSummary(plan)} · {plan.blocks.length} blocks
          </p>
        </CardContent>
        {isPending ? (
          <CardContent>
            <OperationStatus
              status="working"
              title={savedPlanId ? "Starting Range Mode" : "Saving and starting practice"}
              description="Keeping the plan and activity state together before the first block opens."
            />
          </CardContent>
        ) : message ? (
          <CardContent>
            <p role="status" className="mobile-type-callout text-muted-foreground">
              {message}
            </p>
          </CardContent>
        ) : null}
        <CardFooter className="bg-background/70 p-3">
          {activeMeasuredResult || finished ? (
            <Button
              type="button"
              className="min-h-12 w-full rounded-xl text-base"
              onClick={() => regenerate(options)}
              disabled={isPending || !hydrated}
            >
              Build next practice
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-12 w-full rounded-xl text-base"
              onClick={savedPlanId ? resume : saveAndStart}
              disabled={isPending || !hydrated}
            >
              <Save className="size-4" aria-hidden />
              {savedPlanId ? "Resume Range Mode" : "Start practice"}
            </Button>
          )}
        </CardFooter>
      </Card>

      <MobileSegmentedControl
        ariaLabel="Practice duration"
        value={String(options.timeMinutes)}
        onValueChange={(value) =>
          regenerate({ ...options, timeMinutes: Number(value) as typeof options.timeMinutes })
        }
        options={[20, 30, 45, 60].map((value) => ({
          value: String(value),
          label: `${value} min`,
          disabled: isPending,
        }))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="min-h-12">
          <Link href="/practice/quick-range">Quick Range</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-12">
          <Link href="/speed">Speed training</Link>
        </Button>
      </div>
      <section className="grid gap-2.5">
        <IOSSectionHeader
          title="Practice blocks"
          description={`${plan.blocks.length} focused tasks`}
        />
        <Carousel
          opts={{ align: "start", containScroll: "trimSnaps", dragFree: false }}
          setApi={setBlockCarouselApi}
          className="w-full min-w-0 max-w-full"
          aria-label="Practice blocks"
          data-practice-block-carousel
        >
          <CarouselContent className="-ml-3 touch-pan-y">
            {plan.blocks.map((block, index) => (
              <CarouselItem
                key={block.id}
                className="basis-[calc(100%-2rem)] pl-3 sm:basis-[calc(50%-0.5rem)]"
                aria-label={`Block ${index + 1} of ${plan.blocks.length}`}
              >
                <button
                  type="button"
                  disabled={!hydrated}
                  aria-pressed={selectedIndex === index}
                  onClick={() => setSelectedIndex(index)}
                  className={cn(
                    "focus-aaa h-full min-h-36 w-full min-w-0 touch-manipulation rounded-[var(--mobile-radius-lg)] border p-4 text-left outline-none transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
                    selectedIndex === index
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  <span className="block min-w-0">
                    <span className="block text-xs font-semibold opacity-75">
                      {index + 1} of {plan.blocks.length} · Block {block.order}
                    </span>
                    <span className="mt-2 block break-words text-lg font-bold leading-5">
                      {block.title}
                    </span>
                    <span className="mt-2 block text-sm font-medium opacity-90">
                      {clubLabel(block)} · {blockVolume(block)}
                    </span>
                  </span>
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-3 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3">
            <CarouselPrevious className="static size-11 translate-y-0 disabled:invisible" />
            <MobileCarouselPagination
              labels={plan.blocks.map((_, index) => `block ${index + 1}`)}
              selectedIndex={selectedIndex}
              onSelect={(index) => blockCarouselApi?.scrollTo(index)}
              ariaLabel="Choose practice block"
            />
            <CarouselNext className="static size-11 translate-y-0 disabled:invisible" />
          </div>
          <p className="sr-only" aria-live="polite">
            Block {selectedIndex + 1} of {plan.blocks.length}: {selectedBlock?.title}
          </p>
        </Carousel>
      </section>

      {selectedBlock ? <BlockCard block={selectedBlock} /> : null}

      <QuickAdjustments
        key={`${options.timeMinutes}-${options.ballCount ?? "time"}-${options.energy}-${options.intent}-${options.facility}`}
        options={options}
        pending={isPending || !hydrated}
        onChange={(next) => {
          setOptions(next);
          regenerate(next);
        }}
      />

      <IOSDisclosureGroup
        label="Practice support"
        items={[
          {
            value: "why",
            title: "Why this plan?",
            summary: `${plan.why.length} signals`,
            description: "Measured weakness, bag confidence and training load",
            content: (
              <IOSGroupedList label="Plan evidence" className="bg-card">
                {plan.why.map((reason) => (
                  <IOSListRow key={reason} label={reason} icon={CheckCircle2} />
                ))}
                <IOSListRow
                  label="Training load"
                  value={context.trainingLoad.statusLabel}
                  detail={context.trainingLoad.recommendation}
                />
              </IOSGroupedList>
            ),
          },
        ]}
      />
    </div>
  );
}

function SpeedDevelopmentCompanionReadout({ context }: { context: PracticePlannerContext }) {
  const score = context.speed.readinessScore;
  const currentCarry = context.speed.currentCarryYd;
  const targetCarry = context.speed.targetCarryYd ?? 220;

  return (
    <Card size="sm" data-speed-development-readout aria-live="polite">
      <CardHeader>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            {context.speed.projectLabel ?? `Project ${targetCarry}`}
          </p>
          <CardTitle className="mt-1">
            {currentCarry === null || currentCarry === undefined
              ? `Build the ${targetCarry}-yard baseline`
              : `${currentCarry.toFixed(1)} / ${targetCarry} yd`}
          </CardTitle>
        </div>
        <CardAction>
          <Badge variant={context.speed.readinessStatus === "recover" ? "outline" : "secondary"}>
            {score === null || score === undefined
              ? "Readiness building"
              : `${score} · ${context.speed.readinessLabel ?? "BUILD"}`}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {score !== null && score !== undefined ? (
          <Progress value={score} aria-label={`Speed readiness: ${score} out of 100`} />
        ) : null}
        <IOSGroupedList label="Speed development decision" className="bg-card">
          <IOSListRow
            label="Today"
            value={context.speed.readinessLabel ?? "BUILD"}
            detail={context.speed.recommendation}
          />
          <IOSListRow
            label="Next ingredient"
            value={context.speed.limitingFactor ?? "Build evidence"}
            detail={context.speed.projectCoachMessage}
          />
        </IOSGroupedList>
      </CardContent>
    </Card>
  );
}

function BlockCard({ block }: { block: PracticeBlock }) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Task
          </p>
          <p className="mt-1 text-sm leading-5">{block.drill}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Success
          </p>
          <p className="mt-1 text-sm font-semibold leading-5">{block.successTarget}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Key focus
          </p>
          <p className="mt-1 text-sm leading-5">{block.recordPrompt}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAdjustments({
  options,
  pending,
  onChange,
}: {
  options: GeneratePracticePlanOptions;
  pending: boolean;
  onChange: (options: GeneratePracticePlanOptions) => void;
}) {
  const [draft, setDraft] = useState(options);
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" className="min-h-12 w-full rounded-xl">
          Quick adjustments · {draft.timeMinutes} min
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[88dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Quick adjustments</DrawerTitle>
          <DrawerDescription>
            Change time, energy, intent or facilities, then rebuild this plan.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4">
          <FieldGroup>
            <Field>
              <ChoiceGroup
                label="Time"
                options={timeOptions.map((value) => ({
                  value: String(value),
                  label: `${value} min`,
                }))}
                selected={String(draft.timeMinutes)}
                onSelect={(value) =>
                  setDraft({ ...draft, timeMinutes: Number(value), ballCount: null })
                }
                disabled={pending}
              />
            </Field>
            <Field>
              <ChoiceGroup
                label="Energy"
                options={energyOptions}
                selected={draft.energy}
                onSelect={(value) => setDraft({ ...draft, energy: value as PracticeEnergyLevel })}
                disabled={pending}
              />
            </Field>
            <Field>
              <ChoiceGroup
                label="Intent"
                options={intentOptions}
                selected={draft.intent}
                onSelect={(value) => setDraft({ ...draft, intent: value as PracticeIntent })}
                disabled={pending}
              />
            </Field>
            <FieldSet>
              <FieldLegend className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Available facilities
              </FieldLegend>
              <div data-slot="checkbox-group" className="grid grid-cols-2 gap-2">
                {facilityOptions.map((facility) => {
                  const selected = Boolean(draft.facility?.[facility.key]);
                  return (
                    <Field key={facility.key} orientation="horizontal">
                      <Checkbox
                        id={`practice-facility-${facility.key}`}
                        checked={selected}
                        disabled={pending}
                        onCheckedChange={(checked) =>
                          setDraft({
                            ...draft,
                            facility: { ...draft.facility, [facility.key]: checked === true },
                          })
                        }
                      />
                      <FieldLabel
                        htmlFor={`practice-facility-${facility.key}`}
                        className="min-h-11 cursor-pointer rounded-xl border bg-card px-3"
                      >
                        {facility.label}
                      </FieldLabel>
                    </Field>
                  );
                })}
              </div>
            </FieldSet>
            <ButtonGroup className="w-full">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                disabled={pending}
                onClick={() => {
                  setDraft(options);
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  onChange(draft);
                }}
              >
                Apply adjustments
              </Button>
            </ButtonGroup>
          </FieldGroup>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function ChoiceGroup({
  label,
  options,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <MobileFilterChipGroup
        value={selected}
        onValueChange={onSelect}
        ariaLabel={label}
        options={options.map((option) => ({ ...option, disabled }))}
      />
    </div>
  );
}

function FinishedActions({ message, planId }: { message: string | null; planId: string | null }) {
  const query = planId ? `?practicePlanId=${encodeURIComponent(planId)}` : "";
  return (
    <Card data-practice-finished>
      <CardHeader>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Practice complete
          </p>
          <CardTitle className="mt-1 text-xl">Add evidence when it is ready</CardTitle>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{message}</p>
        </div>
      </CardHeader>
      <CardFooter className="p-3">
        <ButtonGroup className="w-full">
          <Button asChild className="min-h-11 flex-1">
            <Link href={`/rapsodo${query}`}>Sync Rapsodo</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 flex-1">
            <Link href={`/import${query}`}>Upload CSV</Link>
          </Button>
        </ButtonGroup>
      </CardFooter>
    </Card>
  );
}

export function compactCompanionPlan(plan: PracticePlan): PracticePlan {
  const blockLimit = plan.estimatedTimeMinutes <= 30 ? 3 : 4;
  if (plan.blocks.length <= blockLimit) return plan;

  const lastIndex = plan.blocks.length - 1;
  const selectedIndexes = Array.from(
    new Set(
      Array.from({ length: blockLimit }, (_, index) =>
        Math.round((index * lastIndex) / (blockLimit - 1)),
      ),
    ),
  );
  // Keep the prescribed main club when reducing the plan for a phone screen.
  const mainIndex = plan.blocks.findIndex((block) => block.title.startsWith("Main priority:"));
  if (mainIndex > 0 && !selectedIndexes.includes(mainIndex)) {
    selectedIndexes[1] = mainIndex;
    selectedIndexes.sort((a, b) => a - b);
  }
  const blocks = selectedIndexes.map((index, order) => ({
    ...plan.blocks[index],
    order: order + 1,
  }));
  const selectedClubs = new Set(blocks.flatMap((block) => block.clubs));
  const focusClubs = Array.from(
    new Set([
      ...plan.focusClubs.filter((club) => selectedClubs.has(club)),
      ...blocks.flatMap((block) => block.clubs),
    ]),
  );
  const totalBalls = blocks.every((block) => block.ballCount !== null)
    ? blocks.reduce((total, block) => total + (block.ballCount ?? 0), 0)
    : null;
  const volume = totalBalls === null ? `${plan.estimatedTimeMinutes}-minute` : `${totalBalls}-ball`;
  const clubSummary = focusClubs.slice(0, 2).map(formatClubType).join(" and ");

  return {
    ...plan,
    blocks,
    focusClubs,
    totalBalls,
    summary: `${volume} session${clubSummary ? ` built around ${clubSummary}` : ""}.`,
  };
}

type CachedActivePractice = {
  planId: string;
  completedBlockIds: string[];
  note: string;
  blockIndex: number;
  plan?: PracticePlan;
  finished?: boolean;
  paused?: boolean;
  remainingBalls?: Record<string, number>;
};

function activePracticeStorageKey(accountId: string) {
  return `fkh:active-practice:${accountId}`;
}

export function cacheActivePractice(
  accountId: string,
  planId: string,
  completedBlockIds: string[],
  note: string,
  blockIndex: number,
  plan?: PracticePlan,
  finished?: boolean,
  remainingBalls?: Record<string, number>,
  paused?: boolean,
) {
  try {
    const cached = readActivePractice(accountId);
    const previous = cached?.planId === planId ? cached : null;
    window.localStorage.setItem(
      activePracticeStorageKey(accountId),
      JSON.stringify({
        planId,
        plan: plan ?? previous?.plan,
        finished: finished ?? previous?.finished ?? false,
        paused: paused ?? previous?.paused ?? false,
        remainingBalls: remainingBalls ?? previous?.remainingBalls,
        completedBlockIds,
        note,
        blockIndex,
      } satisfies CachedActivePractice),
    );
  } catch {
    // Storage can be unavailable in strict or private browsing modes.
  }
}

export function readActivePractice(accountId: string): CachedActivePractice | null {
  try {
    const raw = window.localStorage.getItem(activePracticeStorageKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedActivePractice>;
    if (typeof parsed.planId !== "string") return null;
    return {
      planId: parsed.planId,
      completedBlockIds: Array.isArray(parsed.completedBlockIds)
        ? parsed.completedBlockIds.filter((id): id is string => typeof id === "string")
        : [],
      note: typeof parsed.note === "string" ? parsed.note : "",
      blockIndex:
        typeof parsed.blockIndex === "number" && Number.isFinite(parsed.blockIndex)
          ? Math.max(0, Math.trunc(parsed.blockIndex))
          : 0,
      plan: parsed.plan,
      finished: parsed.finished === true,
      paused: parsed.paused === true,
      remainingBalls:
        parsed.remainingBalls && typeof parsed.remainingBalls === "object"
          ? Object.fromEntries(
              Object.entries(parsed.remainingBalls).filter(
                ([, value]) =>
                  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 999,
              ),
            )
          : {},
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
