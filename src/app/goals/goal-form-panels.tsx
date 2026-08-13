"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";

import { addGoalAction, deleteGoalAction, updateGoalAction } from "@/app/goals/actions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { goalTypeLabel, goalTypes, type SeasonGoal } from "@/lib/product-preferences-model";

export function GoalCreateDialog({ label = "Add goal" }: { label?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="size-4" aria-hidden />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add a measured goal</DialogTitle>
          <DialogDescription>
            Keep the season outcome broad and make this target numerical and evidence-linked.
          </DialogDescription>
        </DialogHeader>
        <GoalForm action={addGoalAction} submitLabel="Add goal" idPrefix="create-goal" />
      </DialogContent>
    </Dialog>
  );
}

export function GoalEditSheet({ goal }: { goal: SeasonGoal }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <Pencil className="size-4" aria-hidden />
          Edit
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit measured goal</SheetTitle>
          <SheetDescription>
            Update the target or current measured baseline without losing its identity.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <GoalForm
            action={updateGoalAction}
            submitLabel="Save goal"
            idPrefix={`edit-${goal.id}`}
            goal={goal}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function GoalDeleteDialog({ goal }: { goal: Pick<SeasonGoal, "id" | "title"> }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="text-destructive">
          <Trash2 className="size-4" aria-hidden />
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove “{goal.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the goal from the season plan. Imported golf evidence is not deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep goal</AlertDialogCancel>
          <form action={deleteGoalAction}>
            <input type="hidden" name="goalId" value={goal.id} />
            <AlertDialogAction type="submit" variant="destructive">
              Remove goal
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function GoalForm({
  action,
  submitLabel,
  idPrefix,
  goal,
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  idPrefix: string;
  goal?: SeasonGoal;
}) {
  const id = (value: string) => `${idPrefix}-${value}`;
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {goal ? <input type="hidden" name="goalId" value={goal.id} /> : null}
      <Field label="Goal type" htmlFor={id("type")}>
        <Select name="type" defaultValue={goal?.type ?? "carry"}>
          <SelectTrigger id={id("type")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {goalTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {goalTypeLabel(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Goal title" htmlFor={id("title")}>
        <Input id={id("title")} name="title" defaultValue={goal?.title} required />
      </Field>
      <Field label="Club or context" htmlFor={id("club")}>
        <Input id={id("club")} name="club" defaultValue={goal?.club} />
      </Field>
      <Field label="Unit" htmlFor={id("unit")}>
        <Input id={id("unit")} name="unit" defaultValue={goal?.unit ?? "yd"} required />
      </Field>
      <Field label="Starting value" htmlFor={id("starting")}>
        <Input
          id={id("starting")}
          name="startingValue"
          type="number"
          step="0.1"
          defaultValue={goal?.startingValue}
          required
        />
      </Field>
      <Field label="Current value" htmlFor={id("current")}>
        <Input
          id={id("current")}
          name="currentValue"
          type="number"
          step="0.1"
          defaultValue={goal?.currentValue}
          required
        />
      </Field>
      <Field label="Target value" htmlFor={id("target")}>
        <Input
          id={id("target")}
          name="targetValue"
          type="number"
          step="0.1"
          defaultValue={goal?.targetValue}
          required
        />
      </Field>
      <Field label="Target date" htmlFor={id("date")}>
        <Input id={id("date")} name="goalTargetDate" type="date" defaultValue={goal?.targetDate} />
      </Field>
      <Field label="Evidence source" htmlFor={id("evidence")} className="md:col-span-2">
        <Input
          id={id("evidence")}
          name="evidenceSource"
          defaultValue={goal?.evidenceSource ?? "Imported session evidence"}
          required
        />
      </Field>
      <Field label="Recommended next action" htmlFor={id("action")} className="md:col-span-2">
        <Input id={id("action")} name="nextAction" defaultValue={goal?.nextAction} required />
      </Field>
      <Button type="submit" className="md:col-span-2">
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
