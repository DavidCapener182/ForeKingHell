"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Upload,
  CheckCircle2,
  MoreHorizontal,
  SkipForward,
} from "lucide-react";
import type { PracticePlan, PracticeBlock } from "@/lib/practice-planner";
import { cn } from "@/lib/utils";
import styles from "@/components/app/mobile-companion.module.css";
import { activityHaptic } from "@/components/app/use-mobile-activity";
import { clubLabel, blockVolume } from "./practice-mobile-format";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
export function ActiveRangeMode({
  plan,
  block,
  blockIndex,
  blockDirection,
  completedBlockIds,
  note,
  remainingBalls,
  onRemainingBalls,
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
  blockDirection: "forward" | "back" | null;
  completedBlockIds: string[];
  note: string;
  remainingBalls: number;
  onRemainingBalls: (count: number) => void;
  pending: boolean;
  onNote: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
  onPause: () => void;
  onFinish: () => void;
  practicePlanId: string | null;
}) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [skipMessage, setSkipMessage] = useState("");
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const completeButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const navigationFocusRef = useRef<"previous" | "next" | null>(null);

  useEffect(() => {
    const navigatedButton =
      navigationFocusRef.current === "previous"
        ? previousButtonRef.current
        : navigationFocusRef.current === "next"
          ? nextButtonRef.current
          : null;
    navigationFocusRef.current = null;
    if (navigatedButton?.disabled) {
      completeButtonRef.current?.focus({ preventScroll: true });
    }
  }, [blockIndex]);

  return (
    <section
      className={styles.rangeStage}
      data-active-range-mode
      onTouchStart={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "button, a, input, textarea, summary, [role='dialog']",
          )
        ) {
          swipeStart.current = null;
          return;
        }
        const t = event.touches[0];
        swipeStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start) return;
        const t = event.changedTouches[0];
        const dx = t.clientX - start.x;
        if (Math.abs(dx) > 70 && Math.abs(t.clientY - start.y) < 45) {
          if (dx < 0) onNext();
          else onPrevious();
        }
      }}
      data-practice-plan-id={practicePlanId ?? undefined}
    >
      <div className={styles.rangeBlock} data-current-range-block>
        <div
          key={block?.id ?? `range-block-${blockIndex}`}
          className={cn("grid gap-3", blockDirection && "t-route-step")}
          data-direction={blockDirection ?? undefined}
          data-current-range-block-content
        >
          <header className={styles.rangeHeader}>
            <p className="mobile-type-footnote text-primary">
              Range Mode · Block {blockIndex + 1} of {plan.blocks.length}
            </p>
            <h1>{block?.title ?? "Practice"}</h1>
            <p className="text-lg text-muted-foreground">
              {block ? `${clubLabel(block)} · ${blockVolume(block)}` : plan.summary}
            </p>
          </header>
          <Progress
            value={plan.blocks.length ? (completedBlockIds.length / plan.blocks.length) * 100 : 0}
            aria-label={`${completedBlockIds.length} of ${plan.blocks.length} practice blocks complete`}
            className="h-2"
          />
          <p className={styles.rangeInstruction}>{block?.drill ?? plan.summary}</p>
          <div className={styles.rangeSuccess}>
            <p className="mobile-type-footnote text-muted-foreground">Success target</p>
            <p className="text-xl font-semibold">{block?.successTarget ?? "Choose a block"}</p>
          </div>
          <p className="mobile-type-footnote text-muted-foreground">
            {block?.recordPrompt ?? "Complete the block, then move to the next task."}
          </p>
        </div>
        <div className="grid gap-3">
          <div className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-2">
            <Button
              ref={previousButtonRef}
              type="button"
              variant="outline"
              size="icon"
              className="size-11 rounded-[var(--mobile-radius-md)]"
              disabled={blockIndex <= 0}
              onClick={() => {
                navigationFocusRef.current = "previous";
                onPrevious();
              }}
              aria-label="Previous practice block"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              ref={completeButtonRef}
              type="button"
              className="min-h-11 rounded-[var(--mobile-radius-md)] px-3"
              disabled={!block}
              onClick={() => {
                activityHaptic();
                onComplete();
                if (blockIndex === plan.blocks.length - 1) setFinishOpen(true);
              }}
            >
              <CheckCircle2 className="size-4" />
              Complete Block
            </Button>
            <Button
              ref={nextButtonRef}
              type="button"
              variant="outline"
              size="icon"
              className="size-11 rounded-[var(--mobile-radius-md)]"
              disabled={blockIndex >= plan.blocks.length - 1}
              onClick={() => {
                navigationFocusRef.current = "next";
                onNext();
              }}
              aria-label="Next practice block"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Complete records activity only. Imported launch-monitor rows decide measured success.
          </p>
          {block?.ballCount !== null && block?.ballCount !== undefined ? (
            <ManualBallCounter remaining={remainingBalls} onChange={onRemainingBalls} />
          ) : null}
        </div>
      </div>
      <details className={styles.rangeNote}>
        <summary className="flex min-h-11 cursor-pointer items-center text-primary">
          {note ? "View note" : "Add note"}
        </summary>
        <label>
          <span className="sr-only">Short note</span>
          <Textarea
            value={note}
            onChange={(event) => onNote(event.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Feel, strike or context"
            className="min-h-20 resize-none"
          />
        </label>
      </details>
      <p role="status" className="sr-only">
        {skipMessage}
      </p>
      <Drawer open={optionsOpen} onOpenChange={setOptionsOpen} repositionInputs={false}>
        <DrawerTrigger asChild>
          <Button type="button" variant="ghost" className="min-h-11 w-full">
            <MoreHorizontal className="size-5" aria-hidden /> Session options
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Practice options</DrawerTitle>
            <DrawerDescription>
              Block {blockIndex + 1} of {plan.blocks.length}
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid divide-y px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="ghost"
              className="min-h-14 justify-start"
              onClick={() => {
                setOptionsOpen(false);
                onPause();
              }}
            >
              <Pause className="size-5" aria-hidden /> Pause session
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-16 justify-start"
              disabled={!block || completedBlockIds.includes(block.id)}
              onClick={() => {
                setOptionsOpen(false);
                setSkipMessage(`${block?.title ?? "Block"} skipped. It remains incomplete.`);
                if (blockIndex === plan.blocks.length - 1) setFinishOpen(true);
                else onNext();
              }}
            >
              <SkipForward className="size-5" aria-hidden />
              <span className="grid text-left">
                <span>Skip block</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Leave incomplete. You can return to it.
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-14 justify-start"
              disabled={pending}
              onClick={() => {
                setOptionsOpen(false);
                setFinishOpen(true);
              }}
            >
              <CheckCircle2 className="size-5" aria-hidden /> Finish practice
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
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

function ManualBallCounter({
  remaining: manualRemaining,
  onChange,
}: {
  remaining: number;
  onChange: (count: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
      <div>
        <p className="text-sm font-semibold">{manualRemaining} balls remaining</p>
        <p className="text-xs text-muted-foreground">Range counter only · not evidence</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          onClick={() => onChange(Math.max(0, manualRemaining - 1))}
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
          onClick={() => onChange(Math.min(999, manualRemaining + 1))}
          aria-label="Add one ball"
        >
          +
        </Button>
      </div>
    </div>
  );
}
