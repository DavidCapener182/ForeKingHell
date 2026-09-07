"use client";
import Link from "next/link";
import type { SeasonGoal } from "@/lib/product-preferences-model";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
export function GoalEvidenceSheet({ goal }: { goal: SeasonGoal }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="min-h-11">
          Evidence
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle>{goal.title} · evidence</SheetTitle>
          <SheetDescription>These are the values explicitly saved for this goal.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <dl className="divide-y rounded-lg border px-3">
            {[
              ["Starting value", `${goal.startingValue} ${goal.unit}`],
              ["Current saved value", `${goal.currentValue} ${goal.unit}`],
              ["Target", `${goal.targetValue} ${goal.unit}`],
              ["Source description", goal.evidenceSource || "Not supplied"],
              ["Target date", goal.targetDate || "Not set"],
              ["Measurement date", "Not recorded"],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-2">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="rounded-lg border p-3 text-sm leading-6">
            A source description does not verify a measurement. No qualifying shot IDs or dated
            measurement history are stored on this goal. Review the original session before updating
            its current value; progress here is calculated from the saved starting, current and
            target values.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/sessions">Review source sessions</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/progress?tab=goals">Compare saved goals in Progress</Link>
            </Button>
          </div>
          <SheetClose asChild>
            <Button variant="outline" className="min-h-11">
              Close evidence
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
