"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Pause, Play, Save, Upload } from "lucide-react";

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
import { OperationStatus } from "@/components/app/operation-status";
import { OperationStepper, type OperationStep } from "@/components/app/operation-stepper";
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
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  const [rangeMode, setRangeMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [blockCarouselApi, setBlockCarouselApi] = useState<CarouselApi>();
  const [isPending, startTransition] = useTransition();
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const selectedBlock = plan.blocks[selectedIndex] ?? plan.blocks[0] ?? null;
  const activeCachedPlan = useMemo(() => readActivePractice(accountId), [accountId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!activeCachedPlan || activeCachedPlan.planId !== savedPlanId) return;
    const timer = window.setTimeout(() => {
      setCompletedBlockIds(activeCachedPlan.completedBlockIds);
      setNote(activeCachedPlan.note);
      setSelectedIndex(Math.min(activeCachedPlan.blockIndex, Math.max(0, plan.blocks.length - 1)));
      setRangeMode(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCachedPlan, plan.blocks.length, savedPlanId]);

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

  useEffect(() => {
    if (!rangeMode || !("wakeLock" in navigator)) return;
    let cancelled = false;
    const wakeLock = navigator.wakeLock as {
      request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
    };
    const acquire = () => {
      if (cancelled || document.visibilityState !== "visible" || wakeLockRef.current) return;
      void wakeLock
        .request("screen")
        .then((sentinel) => {
          if (cancelled) return sentinel.release();
          wakeLockRef.current = sentinel;
        })
        .catch(() => undefined);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") acquire();
      else wakeLockRef.current = null;
    };
    acquire();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [rangeMode]);

  useEffect(() => {
    if (!rangeMode || !savedPlanId || !navigator.onLine) return;
    const timer = window.setTimeout(() => {
      void savePracticeActivityProgressAction(savedPlanId, {
        blockIndex: selectedIndex,
        completedBlockIds,
        note,
      }).catch(() => undefined);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [completedBlockIds, note, rangeMode, savedPlanId, selectedIndex]);

  function regenerate(nextOptions = options) {
    setMessage(null);
    setPlan((current) => ({
      ...current,
      estimatedTimeMinutes: nextOptions.timeMinutes,
    }));
    startTransition(async () => {
      const generated = await generatePracticePlanAction(nextOptions);
      setPlan(compactCompanionPlan(generated));
      setSavedPlanId(null);
      setSelectedIndex(0);
      setCompletedBlockIds([]);
      setFinished(false);
    });
  }

  function saveAndStart() {
    setMessage(null);
    startTransition(async () => {
      const { planId } = await saveAndStartPracticePlanAction(plan);
      setSavedPlanId(planId);
      setPlan((current) => ({ ...current, id: planId, status: "awaiting_import" }));
      setRangeMode(true);
      setPaused(false);
      setFinished(false);
      setCompletedBlockIds([]);
      setSelectedIndex(0);
      cacheActivePractice(accountId, planId, [], "", 0);
      setMessage("Range Mode started. Manual completion is activity, not measured success.");
    });
  }

  function resume() {
    if (!savedPlanId) return;
    startTransition(async () => {
      await startPracticePlanAction(savedPlanId);
      setRangeMode(true);
      setPaused(false);
      cacheActivePractice(accountId, savedPlanId, completedBlockIds, note, selectedIndex);
    });
  }

  function completeBlock() {
    if (!selectedBlock) return;
    const complete = completedBlockIds.includes(selectedBlock.id)
      ? completedBlockIds
      : [...completedBlockIds, selectedBlock.id];
    const nextIndex = Math.min(selectedIndex + 1, plan.blocks.length - 1);
    setCompletedBlockIds(complete);
    setSelectedIndex(nextIndex);
    if (savedPlanId) cacheActivePractice(accountId, savedPlanId, complete, note, nextIndex);
  }

  function finishWithoutUpload() {
    if (!savedPlanId) return;
    startTransition(async () => {
      await completePracticeActivityAction(savedPlanId);
      clearActivePractice(accountId);
      setRangeMode(false);
      setPaused(false);
      setFinished(true);
      setPlan((current) => ({ ...current, status: "completed" }));
      setMessage("Activity complete. No block has been marked as measured success.");
    });
  }

  if (rangeMode) {
    return (
      <ActiveRangeMode
        key={selectedBlock?.id ?? `block-${selectedIndex}`}
        plan={plan}
        block={selectedBlock}
        blockIndex={selectedIndex}
        completedBlockIds={completedBlockIds}
        note={note}
        pending={isPending}
        onNote={(value) => {
          setNote(value);
          if (savedPlanId)
            cacheActivePractice(accountId, savedPlanId, completedBlockIds, value, selectedIndex);
        }}
        onPrevious={() => setSelectedIndex((index) => Math.max(0, index - 1))}
        onNext={() => setSelectedIndex((index) => Math.min(plan.blocks.length - 1, index + 1))}
        onComplete={completeBlock}
        onPause={() => {
          setRangeMode(false);
          setPaused(true);
        }}
        onFinish={finishWithoutUpload}
        practicePlanId={savedPlanId}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <OperationStepper
        compact
        label="Practice workflow"
        steps={practiceWorkflowSteps({
          rangeMode: false,
          saved: Boolean(savedPlanId),
          finished,
          hasEvidence: Boolean(measuredResult),
        })}
      />
      {finished ? <FinishedActions message={message} /> : null}
      {paused ? (
        <Button
          type="button"
          className="min-h-12 rounded-xl"
          onClick={resume}
          disabled={isPending || !hydrated}
        >
          <Play className="size-4" aria-hidden />
          Resume Range Mode
        </Button>
      ) : null}

      <Card className="relative isolate gap-3 overflow-hidden py-4" data-current-practice-plan>
        <div
          className="pointer-events-none absolute inset-0 -z-20 bg-[url('/assets/companion/practice-hero.avif')] bg-cover bg-[68%_center] opacity-30"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-card via-card/90 to-card/60"
          aria-hidden
        />
        <CardHeader>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Recommended session
            </p>
            <CardTitle className="mt-1 text-2xl font-bold leading-7 tracking-tight">
              {plan.title}
            </CardTitle>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{plan.summary}</p>
          </div>
          <CardAction>
            <Badge variant="secondary">{plan.confidenceLabel}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid min-w-0 grid-cols-2 gap-2">
          <PlanMetric label="Time" value={`${plan.estimatedTimeMinutes} min`} />
          <PlanMetric
            label="Volume"
            value={plan.totalBalls === null ? "Time based" : `${plan.totalBalls} balls`}
          />
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
            <OperationStatus status="success" title="Practice updated" description={message} />
          </CardContent>
        ) : null}
        <CardFooter className="bg-background/70 p-3">
          <Button
            type="button"
            className="min-h-12 w-full rounded-xl text-base"
            onClick={savedPlanId ? resume : saveAndStart}
            disabled={isPending || !hydrated}
          >
            <Save className="size-4" aria-hidden />
            {savedPlanId ? "Start Practice" : "Save & Start Practice"}
          </Button>
        </CardFooter>
      </Card>

      <section className="grid gap-2.5">
        <IOSSectionHeader
          title="Practice blocks"
          description={`${plan.blocks.length} focused tasks`}
        />
        <Carousel
          opts={{ align: "start", containScroll: "trimSnaps", dragFree: false }}
          setApi={setBlockCarouselApi}
          className="w-full min-w-0 max-w-full overflow-hidden px-10"
          aria-label="Practice blocks"
          data-practice-block-carousel
        >
          <CarouselContent className="-ml-2">
            {plan.blocks.map((block, index) => (
              <CarouselItem key={block.id} className="basis-[88%] pl-2 sm:basis-1/2">
                <Button
                  type="button"
                  variant={selectedIndex === index ? "default" : "outline"}
                  disabled={!hydrated}
                  aria-pressed={selectedIndex === index}
                  onClick={() => setSelectedIndex(index)}
                  className="h-full min-h-24 w-full min-w-0 justify-start whitespace-normal rounded-xl p-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-xs opacity-75">Block {block.order}</span>
                    <span className="mt-1 block break-words text-sm font-semibold">
                      {block.title}
                    </span>
                    <span className="mt-1 block text-xs opacity-75">{blockVolume(block)}</span>
                  </span>
                </Button>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-0 size-9" />
          <CarouselNext className="right-0 size-9" />
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
          ...(measuredResult
            ? [
                {
                  value: "result",
                  title: "Plan versus actual",
                  summary: `${measuredResult.practiceScore}/100`,
                  description: measuredResult.verdict,
                  content: (
                    <Card size="sm" data-plan-versus-actual>
                      <CardHeader>
                        <CardTitle>Measured plan result</CardTitle>
                        <CardAction>
                          <Badge variant="secondary">{measuredResult.practiceScore}/100</Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent className="grid gap-3">
                        <Progress
                          value={measuredResult.practiceScore}
                          aria-label={`Practice plan score: ${measuredResult.practiceScore} out of 100`}
                        />
                        <IOSGroupedList label="Measured plan result" className="bg-card">
                          <IOSListRow label="Verdict" detail={measuredResult.verdict} />
                          <IOSListRow label="Next action" detail={measuredResult.nextAction} />
                        </IOSGroupedList>
                      </CardContent>
                    </Card>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-background/70 p-3">
      <span className="block break-words text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block break-words text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function BlockCard({ block }: { block: PracticeBlock }) {
  return (
    <Card size="sm">
      <CardHeader>
        <div>
          <p className="text-xs text-muted-foreground">Club</p>
          <h2 className="text-xl font-bold">{clubLabel(block)}</h2>
        </div>
        <CardAction>
          <Badge variant="outline">{blockVolume(block)}</Badge>
        </CardAction>
      </CardHeader>
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
      <ToggleGroup
        type="single"
        value={selected}
        onValueChange={(value) => {
          if (value) onSelect(value);
        }}
        variant="outline"
        className="flex flex-wrap justify-start gap-2"
        aria-label={label}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            disabled={disabled}
            className="min-h-11 rounded-xl px-3 text-sm font-semibold"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function ActiveRangeMode({
  plan,
  block,
  blockIndex,
  completedBlockIds,
  note,
  pending,
  onNote,
  onPrevious,
  onNext,
  onComplete,
  onPause,
  onFinish,
  practicePlanId,
}: {
  plan: PracticePlan;
  block: PracticeBlock | null;
  blockIndex: number;
  completedBlockIds: string[];
  note: string;
  pending: boolean;
  onNote: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
  onPause: () => void;
  onFinish: () => void;
  practicePlanId: string | null;
}) {
  const allComplete = plan.blocks.length > 0 && completedBlockIds.length >= plan.blocks.length;
  const [finishOpen, setFinishOpen] = useState(false);
  const [manualRemaining, setManualRemaining] = useState<number | null>(block?.ballCount ?? null);

  return (
    <section
      className="grid min-h-[calc(100dvh-9rem)] content-start gap-4"
      data-active-range-mode
      data-practice-plan-id={practicePlanId ?? undefined}
    >
      <OperationStepper
        compact
        label="Practice workflow"
        steps={practiceWorkflowSteps({
          rangeMode: true,
          saved: true,
          finished: false,
          hasEvidence: false,
        })}
      />
      <Card className="gap-3 py-3" data-current-range-block>
        <CardHeader className="px-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Range Mode · Block {blockIndex + 1} of {plan.blocks.length}
            </p>
            <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight">
              {block ? clubLabel(block) : "Practice"}
            </h1>
          </div>
          <CardAction>
            <Badge variant={allComplete ? "default" : "secondary"}>
              {completedBlockIds.length}/{plan.blocks.length} complete
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 px-3">
          <Progress
            value={plan.blocks.length ? (completedBlockIds.length / plan.blocks.length) * 100 : 0}
            aria-label={`${completedBlockIds.length} of ${plan.blocks.length} practice blocks complete`}
            className="h-2"
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 rounded-2xl bg-primary p-4 text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
                {manualRemaining !== null ? "Balls remaining" : "Time remaining"}
              </p>
              <p className="mt-1 font-heading text-5xl font-bold tabular-nums">
                {manualRemaining ?? block?.timeMinutes ?? 0}
              </p>
            </div>
            <p className="pb-1 text-sm font-semibold opacity-80">
              {manualRemaining !== null ? "balls" : "minutes"}
            </p>
          </div>
          <div className="rounded-xl bg-secondary/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Task
            </p>
            <p className="mt-1 text-[15px] font-medium leading-6">{block?.drill ?? plan.summary}</p>
            <p className="mt-4 border-t border-border/70 pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Success target
            </p>
            <p className="mt-1 text-lg font-semibold leading-6">
              {block?.successTarget ?? "Choose a block"}
            </p>
            <p className="mt-4 border-t border-border/70 pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Next action
            </p>
            <p className="mt-1 text-[15px] leading-6">
              {block?.recordPrompt ?? "Complete the block, then move to the next task."}
            </p>
          </div>
          <ButtonGroup className="grid w-full grid-cols-[1fr_1.25fr_1fr]">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 px-2"
              disabled={blockIndex <= 0}
              onClick={onPrevious}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button type="button" className="min-h-12 px-2" disabled={!block} onClick={onComplete}>
              <CheckCircle2 className="size-4" />
              Complete
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 px-2"
              disabled={blockIndex >= plan.blocks.length - 1}
              onClick={onNext}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </ButtonGroup>
          <p className="text-xs leading-5 text-muted-foreground">
            Complete records activity only. Imported launch-monitor rows decide measured success.
          </p>
          {manualRemaining !== null ? (
            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
              <div>
                <p className="text-sm font-semibold">Adjust remaining</p>
                <p className="text-xs text-muted-foreground">Range counter only · not evidence</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setManualRemaining((value) => Math.max(0, (value ?? 0) - 1))}
                  aria-label="Remove one ball"
                >
                  −
                </Button>
                <span className="w-8 text-center text-lg font-bold">{manualRemaining}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setManualRemaining((value) => (value ?? 0) + 1)}
                  aria-label="Add one ball"
                >
                  +
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Short note</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={note}
            onChange={(event) => onNote(event.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Feel, strike or context"
            className="min-h-20 resize-none"
          />
        </CardContent>
      </Card>
      <ButtonGroup className="w-full">
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={onPause}>
          <Pause className="size-4" />
          Pause
        </Button>
        <Button
          type="button"
          className="min-h-11 rounded-xl"
          onClick={() => setFinishOpen(true)}
          disabled={pending}
        >
          Finish Practice
        </Button>
      </ButtonGroup>
      <Drawer open={finishOpen} onOpenChange={setFinishOpen} repositionInputs={false}>
        <DrawerContent className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Add measured evidence?</DrawerTitle>
            <DrawerDescription>
              Choose the source you used. Manual activity will not be presented as measured success.
            </DrawerDescription>
          </DrawerHeader>
          <div className="mt-4 grid gap-2">
            <Button asChild className="min-h-12 rounded-xl">
              <Link
                href={`/rapsodo${practicePlanId ? `?practicePlanId=${encodeURIComponent(practicePlanId)}` : ""}`}
              >
                Sync Rapsodo
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12 rounded-xl">
              <Link
                href={`/import?source=csv${practicePlanId ? `&practicePlanId=${encodeURIComponent(practicePlanId)}` : ""}`}
              >
                <Upload className="size-4" /> Choose CSV
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" className="min-h-12" disabled={pending}>
                  Finish without evidence
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Finish without measured evidence?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The activity will be saved, but no block will count as measured success until a
                    launch-monitor session is linked.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep practising</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setFinishOpen(false);
                      onFinish();
                    }}
                  >
                    Finish activity only
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}

function practiceWorkflowSteps({
  rangeMode,
  saved,
  finished,
  hasEvidence,
}: {
  rangeMode: boolean;
  saved: boolean;
  finished: boolean;
  hasEvidence: boolean;
}): OperationStep[] {
  return [
    { id: "brief", label: "Brief", status: "complete" },
    { id: "plan", label: "Plan", status: "complete" },
    {
      id: "start",
      label: "Start",
      status: rangeMode ? "current" : saved || finished || hasEvidence ? "complete" : "current",
    },
    {
      id: "evidence",
      label: "Evidence",
      status: hasEvidence ? "complete" : finished ? "current" : "upcoming",
    },
    { id: "review", label: "Review", status: hasEvidence ? "current" : "upcoming" },
  ];
}

function FinishedActions({ message }: { message: string | null }) {
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
            <Link href="/rapsodo">Sync Rapsodo</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 flex-1">
            <Link href="/import">Upload CSV</Link>
          </Button>
        </ButtonGroup>
      </CardFooter>
    </Card>
  );
}

function clubLabel(block: PracticeBlock) {
  return block.clubs.length > 0 ? block.clubs.map(formatClubType).join(" + ") : "Mixed clubs";
}

function blockVolume(block: PracticeBlock) {
  return block.ballCount === null ? `${block.timeMinutes} min` : `${block.ballCount} balls`;
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
};

function activePracticeStorageKey(accountId: string) {
  return `fkh:active-practice:${accountId}`;
}

function cacheActivePractice(
  accountId: string,
  planId: string,
  completedBlockIds: string[],
  note: string,
  blockIndex: number,
) {
  try {
    window.localStorage.setItem(
      activePracticeStorageKey(accountId),
      JSON.stringify({
        planId,
        completedBlockIds,
        note,
        blockIndex,
      } satisfies CachedActivePractice),
    );
  } catch {
    // Storage can be unavailable in strict or private browsing modes.
  }
}

function readActivePractice(accountId: string): CachedActivePractice | null {
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
      blockIndex: typeof parsed.blockIndex === "number" ? parsed.blockIndex : 0,
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
