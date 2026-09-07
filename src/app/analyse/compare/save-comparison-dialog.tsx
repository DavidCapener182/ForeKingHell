"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { saveSessionComparisonWithStateAction } from "@/app/analyse/compare/actions";

type SaveComparisonDialogProps = {
  filters: {
    focusSessionId: string;
    baselineSessionId: string;
    clubId: string;
    condition: string;
    period?: string;
  };
  defaultName: string;
};

export function SaveComparisonDialog({ filters, defaultName }: SaveComparisonDialogProps) {
  const id = useId();
  const router = useRouter();
  const busy = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <Save className="size-4" aria-hidden="true" />
          Save comparison
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>Save this comparison</DialogTitle>
          <DialogDescription>
            Keep this exact focus, baseline and filter set for a later review.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy.current) return;
            const formData = new FormData(event.currentTarget);
            busy.current = true;
            setPending(true);
            setError(null);
            try {
              const result = await saveSessionComparisonWithStateAction(formData);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            } catch {
              setError("We could not confirm saving. Your fields are retained; try again.");
            } finally {
              busy.current = false;
              setPending(false);
            }
          }}
        >
          <fieldset disabled={pending} className="space-y-4">
            <input type="hidden" name="sessionId" value={filters.focusSessionId} />
            <input type="hidden" name="baselineSessionId" value={filters.baselineSessionId} />
            <input type="hidden" name="clubId" value={filters.clubId} />
            <input type="hidden" name="condition" value={filters.condition} />
            <input type="hidden" name="period" value={filters.period ?? ""} />
            <div className="space-y-2">
              <Label htmlFor={`${id}-name`}>Name</Label>
              <Input
                id={`${id}-name`}
                name="name"
                defaultValue={defaultName}
                maxLength={180}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-experiment`}>Experiment type</Label>
              <Select name="experimentType" defaultValue="session_vs_session">
                <SelectTrigger id={`${id}-experiment`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="session_vs_session">Session vs session</SelectItem>
                  <SelectItem value="lesson">Before/after lesson</SelectItem>
                  <SelectItem value="equipment_change">Equipment change</SelectItem>
                  <SelectItem value="ball_change">Golf ball</SelectItem>
                  <SelectItem value="club_setting">Club setting</SelectItem>
                  <SelectItem value="practice_round">Practice vs round</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-notes`}>Interpretation notes</Label>
              <Textarea
                id={`${id}-notes`}
                name="notes"
                rows={4}
                maxLength={4000}
                className="min-h-28"
                placeholder="What stayed constant, what changed, and what decision will this inform?"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">{pending ? "Saving…" : "Save comparison"}</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
