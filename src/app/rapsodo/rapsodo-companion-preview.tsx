"use client";

import { useMemo, useState, useTransition } from "react";
import { LoaderCircle, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

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
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
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
  const [excludedShotRowNumbers, setExcludedShotRowNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState<"import" | null>(null);
  const [pending, startTransition] = useTransition();
  const excludedRows = useMemo(() => new Set(excludedShotRowNumbers), [excludedShotRowNumbers]);
  const uncertain = useMemo(
    () => uncertainCompanionRapsodoShots(preview, excludedShotRowNumbers),
    [excludedShotRowNumbers, preview],
  );
  const includedShotCount = preview.shots.length - excludedRows.size;
  const uncertainComplete = uncertain.every((shot) =>
    Boolean(selectedByRow[shot.rowNumber] ?? shot.suggestion.choice.clubKey),
  );

  function savePreview() {
    if (!uncertainComplete || includedShotCount === 0 || pending) return;
    if (preview.sessionType !== "range") {
      onMessageChange(
        "Scored course sessions need scorecard confirmation in the Full Site workbench.",
      );
      return;
    }
    setLoading("import");
    onMessageChange(null);
    const shotOverrides = buildCompanionRapsodoShotOverrides(
      preview,
      selectedByRow,
      excludedShotRowNumbers,
    );
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
          excludedShotRowNumbers,
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
            Review every shot, remove any you do not want, then confirm uncertain club matches.
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
              <Badge>
                {includedShotCount} of {preview.shotCount} shots
              </Badge>
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
                  label: "Included",
                  value: String(includedShotCount),
                },
                { label: "Removed", value: String(excludedRows.size) },
              ]}
            />
          </section>
          <Card size="sm" data-rapsodo-shot-review>
            <CardHeader>
              <div>
                <CardTitle>Review shots</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Removed shots stay in R-Cloud but will not be imported.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {preview.shots.map((shot) => {
                const excluded = excludedRows.has(shot.rowNumber);
                const needsConfirmation =
                  shot.suggestion.confidence === "low" || shot.suggestion.confidence === "medium";

                return (
                  <Item
                    key={shot.rowNumber}
                    variant="muted"
                    className={excluded ? "opacity-60" : undefined}
                    data-rapsodo-shot-row={shot.rowNumber}
                    data-shot-excluded={excluded ? "true" : "false"}
                  >
                    <ItemContent className="gap-2">
                      <div>
                        <ItemTitle>
                          Shot {shot.shotNumber ?? shot.rowNumber} · {shot.reportedClubLabel}
                        </ItemTitle>
                        <ItemDescription>
                          Carry {formatMetric(shot.carryYd, "yd")} · Total{" "}
                          {formatMetric(shot.totalYd, "yd")}
                        </ItemDescription>
                      </div>
                      <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                        <ShotMetric label="Ball" value={formatMetric(shot.ballSpeedMph, "mph")} />
                        <ShotMetric label="Launch" value={formatMetric(shot.launchAngleDeg, "°")} />
                        <ShotMetric label="Side" value={formatMetric(shot.sideCarryYd, "yd")} />
                      </dl>
                      {!excluded && needsConfirmation ? (
                        <Field>
                          <FieldLabel htmlFor={`rapsodo-club-${shot.rowNumber}`}>
                            Confirm club
                          </FieldLabel>
                          <Select
                            value={selectedByRow[shot.rowNumber] ?? shot.suggestion.choice.clubKey}
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
                          <p className="text-xs text-muted-foreground">{shot.suggestion.reason}</p>
                        </Field>
                      ) : null}
                    </ItemContent>
                    <ItemActions>
                      <Button
                        type="button"
                        size="sm"
                        variant={excluded ? "outline" : "ghost"}
                        className="min-h-10"
                        onClick={() =>
                          setExcludedShotRowNumbers((current) =>
                            excluded
                              ? current.filter((rowNumber) => rowNumber !== shot.rowNumber)
                              : [...current, shot.rowNumber],
                          )
                        }
                        disabled={pending}
                        aria-label={`${excluded ? "Restore" : "Remove"} shot ${shot.shotNumber ?? shot.rowNumber}`}
                      >
                        {excluded ? <RotateCcw aria-hidden /> : <Trash2 aria-hidden />}
                        {excluded ? "Restore" : "Remove"}
                      </Button>
                    </ItemActions>
                  </Item>
                );
              })}
            </CardContent>
          </Card>
          {uncertain.length === 0 && includedShotCount > 0 ? (
            <Alert>
              <ShieldCheck aria-hidden />
              <AlertTitle>All included club matches are high confidence</AlertTitle>
            </Alert>
          ) : null}
          {includedShotCount === 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Keep at least one shot</AlertTitle>
              <AlertDescription>Restore a shot before importing this session.</AlertDescription>
            </Alert>
          ) : null}
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
            disabled={
              !hydrated ||
              pending ||
              !uncertainComplete ||
              includedShotCount === 0 ||
              preview.sessionType !== "range"
            }
          >
            {loading === "import" ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            ) : null}
            Import {includedShotCount} shot{includedShotCount === 1 ? "" : "s"} and review
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

function ShotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function formatMetric(value: number | null, unit: string) {
  return value === null
    ? "—"
    : `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
