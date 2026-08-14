"use client";

import { useMemo, useState, useTransition } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

import { importRapsodoSessionAction } from "@/app/rapsodo/actions";
import { ConnectedMetricBar } from "@/components/app/connected-metric-bar";
import { OperationStatus } from "@/components/app/operation-status";
import { OperationStepper } from "@/components/app/operation-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldLabel } from "@/components/ui/field";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";
import {
  buildCompanionRapsodoShotOverrides,
  companionRapsodoResultHref,
  uncertainCompanionRapsodoShots,
} from "@/lib/rapsodo/companion-workflow";

export function RapsodoCompanionPreview({
  preview,
  practicePlanId,
  hydrated,
  message,
  onMessageChange,
  onClose,
}: {
  preview: RapsodoSessionPreview;
  practicePlanId: string | null;
  hydrated: boolean;
  message: string | null;
  onMessageChange: (message: string | null) => void;
  onClose: () => void;
}) {
  const [selectedByRow, setSelectedByRow] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<"import" | null>(null);
  const [pending, startTransition] = useTransition();
  const uncertain = useMemo(() => uncertainCompanionRapsodoShots(preview), [preview]);
  const uncertainComplete = uncertain.every((shot) =>
    Boolean(selectedByRow[shot.rowNumber] ?? shot.suggestion.choice.clubKey),
  );

  function savePreview() {
    if (!uncertainComplete || pending) return;
    if (preview.sessionType !== "range") {
      onMessageChange(
        "Scored course sessions need scorecard confirmation in the Full Site workbench.",
      );
      return;
    }
    setLoading("import");
    onMessageChange(null);
    const shotOverrides = buildCompanionRapsodoShotOverrides(preview, selectedByRow);
    startTransition(async () => {
      const result = await importRapsodoSessionAction({
        session: preview.session,
        importInput: {
          rawCsvText: preview.rawCsvText,
          fileName: preview.fileName,
          fileSizeBytes: preview.fileSizeBytes,
          source: "rapsodo",
          sessionType: preview.sessionType,
          sessionDate: preview.sessionDate,
          distanceUnit: preview.distanceUnit,
          shotOverrides,
          practicePlanId: practicePlanId ?? undefined,
        },
      });
      if (!result.ok) {
        setLoading(null);
        onMessageChange(result.message);
        return;
      }
      if (!result.data.ok) {
        setLoading(null);
        onMessageChange(result.data.message);
        return;
      }
      const destination = new URL(
        companionRapsodoResultHref(result.data.sessionId),
        window.location.origin,
      );
      window.location.assign(destination);
    });
  }

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      data-rapsodo-companion-preview
    >
      <DrawerContent className="max-h-[92dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Session preview</DrawerTitle>
          <DrawerDescription>
            Check the R-Cloud session and confirm only the uncertain club matches.
          </DrawerDescription>
        </DrawerHeader>
        <div
          className="grid min-h-0 gap-4 overflow-y-auto px-4 pb-4"
          data-hydrated={hydrated ? "true" : "false"}
        >
          <OperationStepper
            compact
            label="R-Cloud import progress"
            steps={[
              { id: "preview", label: "Preview", status: "complete" },
              {
                id: "mapping",
                label: "Map clubs",
                status: uncertainComplete ? "complete" : "current",
              },
              {
                id: "import",
                label: "Import",
                status: loading === "import" ? "current" : "upcoming",
              },
              { id: "review", label: "Review", status: "upcoming" },
            ]}
          />
          <section className="grid gap-2" data-rapsodo-preview-summary>
            <div className="flex items-start justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Session preview
                </p>
                <h1 className="mt-1 truncate text-xl font-bold">{preview.session.title}</h1>
              </div>
              <Badge>{preview.shotCount} shots</Badge>
            </div>
            <ConnectedMetricBar
              label="R-Cloud session summary"
              className="grid-cols-2 [&>div:nth-child(2)]:border-l [&>div:nth-child(2)]:border-t-0"
              metrics={[
                { label: "Date", value: formatDate(preview.sessionDate) },
                {
                  label: "Type",
                  value: preview.sessionType === "range" ? "Range practice" : "Scored course",
                },
                {
                  label: "Detected clubs",
                  value: String(
                    new Set(preview.shots.map((shot) => shot.suggestion.choice.clubType)).size,
                  ),
                },
                { label: "Needs confirmation", value: String(uncertain.length) },
              ]}
            />
          </section>
          {uncertain.length > 0 ? (
            <Card size="sm" data-uncertain-club-mappings>
              <CardHeader>
                <div>
                  <CardTitle>Confirm uncertain clubs</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Trusted matches are already accepted.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <Table aria-label="Uncertain R-Cloud club mappings">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shot</TableHead>
                      <TableHead>Suggested club</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uncertain.map((shot) => (
                      <TableRow key={shot.rowNumber}>
                        <TableCell className="whitespace-normal">
                          <span className="font-medium">
                            Shot {shot.shotNumber ?? shot.rowNumber} ·{" "}
                            {Math.round(shot.carryYd ?? 0)} yd
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {shot.suggestion.reason}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-44">
                          <Field>
                            <FieldLabel
                              htmlFor={`rapsodo-club-${shot.rowNumber}`}
                              className="sr-only"
                            >
                              Club for shot {shot.shotNumber ?? shot.rowNumber}
                            </FieldLabel>
                            <Select
                              value={
                                selectedByRow[shot.rowNumber] ?? shot.suggestion.choice.clubKey
                              }
                              onValueChange={(value) =>
                                setSelectedByRow((current) => ({
                                  ...current,
                                  [shot.rowNumber]: value,
                                }))
                              }
                            >
                              <SelectTrigger
                                id={`rapsodo-club-${shot.rowNumber}`}
                                className="min-h-11 w-full"
                              >
                                <SelectValue placeholder="Choose a club" />
                              </SelectTrigger>
                              <SelectContent>
                                {preview.clubChoices.map((choice) => (
                                  <SelectItem key={choice.clubKey} value={choice.clubKey}>
                                    {choice.clubLabel}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <ShieldCheck aria-hidden />
              <AlertTitle>All club matches are high confidence</AlertTitle>
            </Alert>
          )}
          {preview.sessionType !== "range" ? (
            <Alert>
              <AlertTitle>Scorecard confirmation required</AlertTitle>
              <AlertDescription>
                Open Full Site to import this course session without guessing holes or scores.
              </AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert variant="destructive">
              <AlertTitle>R-Cloud import could not continue</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          {loading === "import" ? (
            <OperationStatus
              status="working"
              title="Importing measured shots"
              description="Saving the provider session once, then building the common review."
              progress={72}
            />
          ) : null}
          <Button
            type="button"
            className="min-h-12 rounded-xl"
            onClick={savePreview}
            disabled={!hydrated || pending || !uncertainComplete || preview.sessionType !== "range"}
          >
            {loading === "import" ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            ) : null}
            Import and review
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={onClose}
            disabled={!hydrated || pending}
          >
            Back to inbox
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
