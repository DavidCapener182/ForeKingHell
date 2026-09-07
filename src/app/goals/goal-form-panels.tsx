"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DraftForm } from "@/components/untitled-ui/draft-form";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  addGoalWithStateAction,
  deleteGoalWithStateAction,
  updateGoalWithStateAction,
  type GoalFormResult,
} from "@/app/goals/actions";
import {
  AlertDialog,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { goalTypeLabel, goalTypes, type SeasonGoal } from "@/lib/product-preferences-model";

export function GoalCreateDialog({ label = "Add goal" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [creationId, setCreationId] = useState("");
  const router = useRouter();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          if (value && !creationId) setCreationId(crypto.randomUUID());
        }
      }}
    >
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
        <GoalForm
          action={addGoalWithStateAction}
          submitLabel="Add goal"
          idPrefix="create-goal"
          creationId={creationId}
          onPendingChange={setPending}
          onCancel={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            setCreationId(crypto.randomUUID());
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function GoalEditSheet({ goal }: { goal: SeasonGoal }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
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
            action={updateGoalWithStateAction}
            onPendingChange={setPending}
            onCancel={() => setOpen(false)}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
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
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          setOpen(value);
          if (value) setError("");
        }
      }}
    >
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
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep goal</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            className="min-h-11"
            onClick={() =>
              startTransition(async () => {
                const data = new FormData();
                data.set("goalId", goal.id);
                setError("");
                try {
                  const result = await deleteGoalWithStateAction(data);
                  if (result.ok) {
                    setOpen(false);
                    router.refresh();
                  } else setError(result.error);
                } catch {
                  setError("The goal could not be removed. It is still shown here; try again.");
                }
              })
            }
          >
            {pending ? "Removing…" : "Remove goal"}
          </Button>
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
  creationId,
  onSuccess,
  onCancel,
  onPendingChange,
}: {
  action: (formData: FormData) => Promise<GoalFormResult>;
  creationId?: string;
  onSuccess?: () => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
  submitLabel: string;
  idPrefix: string;
  goal?: SeasonGoal;
}) {
  const id = (value: string) => `${idPrefix}-${value}`;
  const [starting, setStarting] = useState(String(goal?.startingValue ?? ""));
  const [target, setTarget] = useState(String(goal?.targetValue ?? ""));
  return (
    <DraftForm
      action={action}
      submitLabel={submitLabel}
      creationId={creationId}
      onSuccess={onSuccess}
      onCancel={onCancel}
      onPendingChange={onPendingChange}
    >
      {goal ? <input type="hidden" name="goalId" value={goal.id} /> : null}
      <UntitledSelect
        label="Goal type"
        name="type"
        defaultValue={goal?.type ?? "carry"}
        options={goalTypes.map((type) => ({ value: type, label: goalTypeLabel(type) }))}
        required
      />
      <Field label="Goal title" htmlFor={id("title")}>
        <Input
          className="min-h-11"
          id={id("title")}
          name="title"
          defaultValue={goal?.title}
          required
        />
      </Field>
      <Field label="Club or context" htmlFor={id("club")}>
        <Input className="min-h-11" id={id("club")} name="club" defaultValue={goal?.club} />
      </Field>
      <Field label="Unit" htmlFor={id("unit")}>
        <Input
          className="min-h-11"
          id={id("unit")}
          name="unit"
          defaultValue={goal?.unit ?? "yd"}
          required
        />
      </Field>
      <Field label="Starting value" htmlFor={id("starting")}>
        <Input
          className="min-h-11"
          id={id("starting")}
          name="startingValue"
          type="number"
          step="0.1"
          value={starting}
          onChange={(event) => setStarting(event.target.value)}
          required
        />
      </Field>
      <Field label="Current value" htmlFor={id("current")}>
        <Input
          className="min-h-11"
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
          className="min-h-11"
          id={id("target")}
          name="targetValue"
          type="number"
          step="0.1"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          required
        />
      </Field>
      <Field label="Target date" htmlFor={id("date")}>
        <Input
          className="min-h-11"
          id={id("date")}
          name="goalTargetDate"
          type="date"
          defaultValue={goal?.targetDate}
        />
      </Field>
      <Field label="Evidence source" htmlFor={id("evidence")} className="sm:col-span-2">
        <Input
          className="min-h-11"
          id={id("evidence")}
          name="evidenceSource"
          defaultValue={goal?.evidenceSource ?? "Manually saved goal value"}
          required
        />
      </Field>
      <Field label="Recommended next action" htmlFor={id("action")} className="sm:col-span-2">
        <Input
          className="min-h-11"
          id={id("action")}
          name="nextAction"
          defaultValue={goal?.nextAction}
          required
        />
      </Field>
      <p className="text-sm leading-6 text-muted-foreground sm:col-span-2">
        {starting !== "" &&
        target !== "" &&
        Number.isFinite(Number(starting)) &&
        Number.isFinite(Number(target))
          ? Number(target) < Number(starting)
            ? "Lower values move this goal towards its target."
            : Number(target) > Number(starting)
              ? "Higher values move this goal towards its target."
              : "The target matches the starting value. Review whether this is a maintenance goal."
          : "Set a starting value and target to show the direction of progress."}{" "}
        Current values are saved explicitly; adding a source label does not automatically verify
        imported evidence.
      </p>
    </DraftForm>
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
