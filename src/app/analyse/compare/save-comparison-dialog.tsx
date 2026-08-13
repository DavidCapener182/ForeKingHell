"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { saveSessionComparisonAction } from "@/app/analyse/compare/actions";

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
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">
          <Save className="size-4" aria-hidden="true" />
          Save comparison
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this comparison</DialogTitle>
          <DialogDescription>
            Keep this exact focus, baseline and filter set for a later review.
          </DialogDescription>
        </DialogHeader>
        <form action={saveSessionComparisonAction} className="space-y-4">
          <input type="hidden" name="sessionId" value={filters.focusSessionId} />
          <input type="hidden" name="baselineSessionId" value={filters.baselineSessionId} />
          <input type="hidden" name="clubId" value={filters.clubId} />
          <input type="hidden" name="condition" value={filters.condition} />
          <input type="hidden" name="period" value={filters.period ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="comparison-name">Name</Label>
            <Input id="comparison-name" name="name" defaultValue={defaultName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comparison-experiment-type">Experiment type</Label>
            <Select name="experimentType" defaultValue="session_vs_session">
              <SelectTrigger id="comparison-experiment-type" className="w-full">
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
            <Label htmlFor="comparison-notes">Interpretation notes</Label>
            <Textarea
              id="comparison-notes"
              name="notes"
              rows={4}
              maxLength={4000}
              className="min-h-28"
              placeholder="What stayed constant, what changed, and what decision will this inform?"
            />
          </div>
          <DialogFooter>
            <Button type="submit">Save comparison</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
