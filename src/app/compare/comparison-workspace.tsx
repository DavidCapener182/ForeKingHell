"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Info, Save, Trash2, TriangleAlert } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { DataToolbar } from "@/components/app/data-toolbar";
import {
  DesktopTableWorkbenchControls,
  type DesktopSavedViewSuggestion,
  type DesktopWorkbenchColumn,
} from "@/components/app/desktop-workbench";
import { EntityCombobox, type EntityComboboxOption } from "@/components/app/entity-combobox";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { StatusTimeline } from "@/components/app/status-timeline";
import { DataTableFrame, StatusPill, type Tone } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { ButtonGroup } from "@/components/ui/button-group";
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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteWorkspaceComparisonAction,
  saveWorkspaceComparisonAction,
} from "@/app/compare/actions";

export type ComparisonTableRow = {
  id: string;
  metric: string;
  focus: string;
  baseline: string;
  delta: string;
  direction: string;
  directionTone: Tone;
  confidence: string;
  confidenceTone: Tone;
};

export type SavedWorkspaceComparison = {
  id: string;
  view: "progress" | "clubs" | "players";
  name: string;
  capturedAt: string;
  description: string;
  notes: string | null;
};

const comparisonColumns: DesktopWorkbenchColumn[] = [
  { id: "metric", label: "Metric", locked: true },
  { id: "focus", label: "Focus" },
  { id: "baseline", label: "Baseline" },
  { id: "delta", label: "Delta" },
  { id: "direction", label: "Direction" },
  { id: "confidence", label: "Confidence" },
];

const comparisonSuggestedViews: DesktopSavedViewSuggestion[] = [
  {
    title: "Report export",
    href: "/compare",
    detail: "Export the currently applied comparison rows for a coach or progress report.",
  },
];

export function ComparisonWorkspace({
  view,
  focusValue,
  baselineValue,
  appliedFocusValue = focusValue,
  appliedBaselineValue = baselineValue,
  onFocusValueChange,
  onBaselineValueChange,
  onCompare,
  onReset,
  focusLabel,
  baselineLabel,
  focusOptions,
  baselineOptions,
  rows,
  sampleReady,
  sampleTitle,
  sampleDescription,
  evidenceTitle,
  evidenceDescription,
  evidence,
  savedComparisons,
  exportFileName,
  empty,
}: {
  view: SavedWorkspaceComparison["view"];
  focusValue: string;
  baselineValue: string;
  appliedFocusValue?: string;
  appliedBaselineValue?: string;
  onFocusValueChange: (value: string) => void;
  onBaselineValueChange: (value: string) => void;
  onCompare: () => void;
  onReset: () => void;
  focusLabel: string;
  baselineLabel: string;
  focusOptions: EntityComboboxOption[];
  baselineOptions: EntityComboboxOption[];
  rows: ComparisonTableRow[];
  sampleReady: boolean;
  sampleTitle: string;
  sampleDescription: string;
  evidenceTitle: string;
  evidenceDescription: string;
  evidence: React.ReactNode;
  savedComparisons: SavedWorkspaceComparison[];
  exportFileName: string;
  empty?: React.ReactNode;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const exportTableId = `comparison-${view}`;

  return (
    <section className="grid gap-4" data-comparison-workspace={view}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCompare();
        }}
      >
        <DataToolbar
          resultLabel={`${rows.length} comparable metrics`}
          filters={
            <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-2 xl:min-w-[42rem]">
              <EntityCombobox
                label="Focus"
                value={focusValue}
                onValueChange={onFocusValueChange}
                options={focusOptions}
                placeholder="Choose focus"
                searchPlaceholder="Search focus options…"
              />
              <EntityCombobox
                label="Baseline"
                value={baselineValue}
                onValueChange={onBaselineValueChange}
                options={baselineOptions}
                placeholder="Choose baseline"
                searchPlaceholder="Search baseline options…"
              />
            </div>
          }
          actions={
            <ButtonGroup aria-label="Comparison actions">
              <Button type="submit">Compare</Button>
              <Button type="button" variant="outline" onClick={onReset}>
                Reset
              </Button>
            </ButtonGroup>
          }
        />
      </form>

      {rows.length ? (
        <>
          <div data-workbench-scope={exportTableId} data-comparison-table>
            <DesktopTableWorkbenchControls
              viewKey={exportTableId}
              scope={exportTableId}
              currentViewLabel={`${focusLabel} compared with ${baselineLabel}`}
              resultLabel={`${rows.length} comparable metrics`}
              columns={comparisonColumns}
              suggestedViews={comparisonSuggestedViews}
              exportTableId={exportTableId}
              exportFileName={exportFileName}
              className="mb-3"
            />
            <DataTableFrame
              mainTable
              mainTableId={`${exportTableId}-table`}
              mainTableLabel={`${focusLabel} and ${baselineLabel} comparison table`}
              stickyFirstColumn
            >
              <Table data-workbench-export-table={exportTableId}>
                <TableCaption>
                  {focusLabel} compared with {baselineLabel}; direction and confidence are shown for
                  every metric.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead data-column="metric">Metric</TableHead>
                    <TableHead data-column="focus" className="text-right">
                      Focus
                    </TableHead>
                    <TableHead data-column="baseline" className="text-right">
                      Baseline
                    </TableHead>
                    <TableHead data-column="delta" className="text-right">
                      Delta
                    </TableHead>
                    <TableHead data-column="direction">Direction</TableHead>
                    <TableHead data-column="confidence">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell data-column="metric" className="font-semibold">
                        {row.metric}
                      </TableCell>
                      <TableCell data-column="focus" className="text-right tabular-nums">
                        {row.focus}
                      </TableCell>
                      <TableCell data-column="baseline" className="text-right tabular-nums">
                        {row.baseline}
                      </TableCell>
                      <TableCell
                        data-column="delta"
                        className="text-right font-semibold tabular-nums"
                      >
                        {row.delta}
                      </TableCell>
                      <TableCell data-column="direction">
                        <StatusPill tone={row.directionTone}>{row.direction}</StatusPill>
                      </TableCell>
                      <TableCell data-column="confidence">
                        <StatusPill tone={row.confidenceTone}>{row.confidence}</StatusPill>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTableFrame>
          </div>

          <Alert
            className={
              sampleReady
                ? "border-[var(--status-success-border)] bg-[var(--status-success-surface)]"
                : "border-[var(--status-warning-border)] bg-[var(--status-warning-surface)]"
            }
          >
            {sampleReady ? (
              <CircleCheck className="size-4" aria-hidden />
            ) : (
              <TriangleAlert className="size-4" aria-hidden />
            )}
            <AlertTitle>{sampleTitle}</AlertTitle>
            <AlertDescription>{sampleDescription}</AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-center gap-2">
            <ResponsiveDetailPanel
              open={detailOpen}
              onOpenChange={setDetailOpen}
              title={evidenceTitle}
              description={evidenceDescription}
              trigger={
                <Button type="button" variant="outline">
                  <Info className="size-4" aria-hidden />
                  Inspect evidence
                </Button>
              }
              contentClassName="grid gap-4"
            >
              {evidence}
            </ResponsiveDetailPanel>
            <SaveWorkspaceComparisonDialog
              view={view}
              focusId={appliedFocusValue}
              baselineId={appliedBaselineValue}
              defaultName={`${focusLabel} vs ${baselineLabel}`}
            />
          </div>
        </>
      ) : (
        (empty ?? (
          <AppEmptyState
            title="Choose two comparison sides"
            description="Select a focus and baseline to create the comparison table."
            primaryAction={null}
          />
        ))
      )}

      <section className="grid gap-3" aria-labelledby={`${view}-saved-comparisons-title`}>
        <div>
          <h2 id={`${view}-saved-comparisons-title`} className="text-lg font-semibold">
            Saved comparisons
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisit frozen filters, evidence and interpretation notes.
          </p>
        </div>
        <StatusTimeline
          label={`Saved ${view} comparisons`}
          className="rounded-xl border bg-card p-4"
          items={savedComparisons.map((comparison) => ({
            id: comparison.id,
            dateGroup: new Intl.DateTimeFormat("en-GB", {
              month: "long",
              year: "numeric",
            }).format(new Date(comparison.capturedAt)),
            timestamp: new Intl.DateTimeFormat("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(comparison.capturedAt)),
            title: comparison.name,
            description: comparison.description,
            meta: comparison.notes || "No interpretation note added.",
            kind: "reviewed" as const,
            action: <DeleteWorkspaceComparisonButton id={comparison.id} name={comparison.name} />,
          }))}
          empty={
            <AppEmptyState
              title="No saved comparison yet"
              description="Save a useful comparison when its evidence is worth revisiting."
              primaryAction={null}
              className="py-8"
            />
          }
        />
      </section>
    </section>
  );
}

function SaveWorkspaceComparisonDialog({
  view,
  focusId,
  baselineId,
  defaultName,
}: {
  view: SavedWorkspaceComparison["view"];
  focusId: string;
  baselineId: string;
  defaultName: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">
          <Save className="size-4" aria-hidden />
          Save comparison
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this comparison</DialogTitle>
          <DialogDescription>
            Keep the selected focus, baseline and interpretation for a later review.
          </DialogDescription>
        </DialogHeader>
        <form action={saveWorkspaceComparisonAction} className="space-y-4">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="focusId" value={focusId} />
          <input type="hidden" name="baselineId" value={baselineId} />
          <div className="space-y-2">
            <Label htmlFor={`${view}-comparison-name`}>Name</Label>
            <Input id={`${view}-comparison-name`} name="name" defaultValue={defaultName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${view}-comparison-notes`}>Interpretation notes</Label>
            <Textarea
              id={`${view}-comparison-notes`}
              name="notes"
              rows={4}
              maxLength={4000}
              className="min-h-28"
              placeholder="What changed, how confident is it, and what decision will it inform?"
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

function DeleteWorkspaceComparisonButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={pending}>
          <Trash2 className="size-4" aria-hidden />
          {pending ? "Deleting…" : "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the saved comparison. Source sessions, rounds and shots are unchanged.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep comparison</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              startTransition(async () => {
                const formData = new FormData();
                formData.set("snapshotId", id);
                await deleteWorkspaceComparisonAction(formData);
              });
            }}
          >
            Delete comparison
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
