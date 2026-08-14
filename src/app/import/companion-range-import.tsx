"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, FileUp } from "lucide-react";

import { saveRapsodoImportAction } from "@/app/import/actions";
import { useImportFiles } from "@/app/import/use-import-files";
import { OperationStatus } from "@/components/app/operation-status";
import { OperationStepper, type OperationStep } from "@/components/app/operation-stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { formatClubType, formatCompanionClubType } from "@/lib/club-format";
import { MAX_IMPORT_CSV_BYTES, formatMegabytes } from "@/lib/imports/import-limits";
import type { RapsodoShotOverride } from "@/lib/imports/save-rapsodo-import";
import { queueOfflineAction } from "@/lib/offline-queue";
import { isOfflineImportStorageEnabled } from "@/lib/offline-storage-preferences";

const clubOptions = [
  "driver",
  "3w",
  "5w",
  "7w",
  "3h",
  "4h",
  "5h",
  "3i",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "pw",
  "gw",
  "aw",
  "sw",
  "lw",
] as const;

type SaveProgress = "idle" | "checking" | "saving" | "building" | "queued" | "error";

export function CompanionRangeImport({ practicePlanId }: { practicePlanId: string | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [distanceUnit, setDistanceUnit] = useState<"yards" | "meters">("yards");
  const { parsedFiles, readProgress, readSelectedFiles, clearFiles } = useImportFiles(
    distanceUnit,
    {},
  );
  const [duplicate, setDuplicate] = useState<{
    checked: boolean;
    duplicate: boolean;
    sessionId: string | null;
  }>({
    checked: false,
    duplicate: false,
    sessionId: null,
  });
  const [clubMappings, setClubMappings] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<SaveProgress>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const file = parsedFiles[0] ?? null;
  const rawCsvText = file?.rawCsvText ?? null;
  const unknownGroups = useMemo(() => {
    if (!file) return [];
    const groups = new Map<string, number[]>();
    for (const shot of file.parsed.shots) {
      if (shot.clubType !== "unknown" && shot.clubType !== "other") continue;
      const label = shot.clubTypeRaw?.trim() || "Unknown club";
      groups.set(label, [...(groups.get(label) ?? []), shot.rowNumber]);
    }
    return [...groups.entries()].map(([label, rowNumbers]) => ({ label, rowNumbers }));
  }, [file]);
  const mappingsComplete = unknownGroups.every((group) => Boolean(clubMappings[group.label]));

  useEffect(() => {
    if (!rawCsvText) return;
    const controller = new AbortController();
    void fetch("/api/imports/duplicate-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawCsvText }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Duplicate check failed.");
        const result = (await response.json()) as {
          duplicate?: unknown;
          sessionId?: unknown;
        };
        setDuplicate({
          checked: true,
          duplicate: result.duplicate === true,
          sessionId: typeof result.sessionId === "string" ? result.sessionId : null,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDuplicate({ checked: true, duplicate: false, sessionId: null });
        }
      });
    return () => {
      controller.abort();
    };
  }, [rawCsvText]);

  async function chooseFiles(files: FileList | null) {
    const selected = files?.[0];
    if (!selected) return;
    setMessage(null);
    setProgress("idle");
    setClubMappings({});
    setDuplicate({ checked: false, duplicate: false, sessionId: null });
    clearFiles();
    if (selected.size > MAX_IMPORT_CSV_BYTES) {
      setProgress("error");
      setMessage(
        `This file is too large. Maximum CSV size is ${formatMegabytes(MAX_IMPORT_CSV_BYTES)}.`,
      );
      return;
    }
    await readSelectedFiles([selected]);
  }

  function reset() {
    clearFiles();
    setClubMappings({});
    setProgress("idle");
    setMessage(null);
    setDuplicate({ checked: false, duplicate: false, sessionId: null });
  }

  function save() {
    if (!file || !mappingsComplete || pending || progress === "queued") return;
    setProgress("checking");
    setMessage(null);
    const shotOverrides: RapsodoShotOverride[] = unknownGroups.flatMap((group) =>
      group.rowNumbers.map((rowNumber) => ({
        rowNumber,
        clubType: clubMappings[group.label]!,
      })),
    );
    const input = {
      rawCsvText: file.rawCsvText,
      fileName: file.fileName,
      fileSizeBytes: file.fileSizeBytes,
      source: file.parsed.source,
      sessionType: "range" as const,
      sessionDate: file.parsed.exportedAtIso ?? new Date().toISOString(),
      distanceUnit,
      shotOverrides: shotOverrides.length > 0 ? shotOverrides : undefined,
      practicePlanId: practicePlanId ?? undefined,
    };

    startTransition(async () => {
      if (!navigator.onLine) {
        if (!isOfflineImportStorageEnabled()) {
          setProgress("error");
          setMessage(
            "Offline import storage is off for this device. Enable it in Settings before queuing a CSV.",
          );
          return;
        }
        await queueOfflineAction({
          id: `import-csv-${Date.now()}-${crypto.randomUUID()}`,
          kind: "import-csv",
          payload: { inputs: [input] },
        });
        setProgress("queued");
        setMessage("Queued on this phone. Analysis will appear after the upload syncs.");
        clearFiles();
        return;
      }

      setProgress("saving");
      const result = await saveRapsodoImportAction(input).catch((error: unknown) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : "The import could not be saved.",
      }));
      if (!result.ok) {
        setProgress("error");
        setMessage(result.message);
        return;
      }
      if (result.skipped && duplicate.sessionId) {
        setProgress("building");
        navigateToImportResult(duplicate.sessionId);
        return;
      }
      setProgress("building");
      navigateToImportResult(result.sessionId);
    });
  }

  if (!file) {
    return (
      <Card data-companion-csv-import>
        <CardHeader>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Import a session
            </p>
            <CardTitle className="mt-1 text-2xl">Choose a range CSV</CardTitle>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Pick one launch-monitor export. It is checked on this phone before anything is saved.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Input
            ref={fileInputRef}
            id="companion-csv-file"
            type="file"
            className="sr-only"
            accept=".csv,text/csv,application/csv,application/vnd.ms-excel,text/plain"
            onChange={(event) => {
              void chooseFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            className="min-h-12 rounded-xl text-base"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="size-5" aria-hidden />
            Choose CSV from Files
          </Button>
          {readProgress ? (
            <OperationStatus
              status="working"
              title={`Reading ${readProgress.fileName}`}
              description="Checking the selected file on this phone."
              progress={
                readProgress.total > 0
                  ? (readProgress.loaded / readProgress.total) * 100
                  : undefined
              }
            />
          ) : null}
          {message ? (
            <Alert variant="destructive">
              <AlertTitle>This file cannot be imported</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const clubs = [
    ...new Set(
      file.parsed.shots.map((shot) =>
        shot.clubType === "unknown" || shot.clubType === "other"
          ? shot.clubLabel
          : formatCompanionClubType(shot.clubType),
      ),
    ),
  ];
  const excludedRows = Math.max(0, file.parsed.rowCount - file.parsed.shotCount - 1);
  const workflowSteps = importWorkflowSteps({
    duplicateChecked: duplicate.checked,
    mappingsComplete,
    progress,
  });

  return (
    <div className="grid gap-4" data-companion-csv-confirmation>
      <OperationStepper steps={workflowSteps} label="CSV import progress" compact />
      <Card data-import-preview-card>
        <CardHeader>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Ready to save
            </p>
            <CardTitle className="mt-1 truncate text-xl">{file.fileName}</CardTitle>
          </div>
          <CardAction>
            <Badge variant={unknownGroups.length === 0 ? "default" : "outline"}>
              {unknownGroups.length === 0 ? "Clubs matched" : "Check clubs"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Table aria-label="Parsed session summary" className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Session field</TableHead>
                <TableHead className="text-right">Imported value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Provider", providerLabel(file.parsed.source)],
                ["Session date", formatDate(file.parsed.exportedAtIso)],
                ["Session type", "Range practice"],
                ["Shots", String(file.parsed.shotCount)],
                ["Clubs", clubs.join(", ") || "Needs mapping"],
                [
                  "Distance unit",
                  file.parsed.detectedDistanceUnit === "unknown"
                    ? distanceUnit
                    : file.parsed.detectedDistanceUnit,
                ],
                ["Excluded rows", String(excludedRows)],
              ].map(([label, value]) => (
                <TableRow key={label}>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="max-w-48 whitespace-normal text-right">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/35 p-3">
            <span className="text-sm font-medium">Duplicate check</span>
            <Badge variant={duplicate.duplicate ? "destructive" : "secondary"}>
              {!duplicate.checked
                ? "Checking…"
                : duplicate.duplicate
                  ? "Already imported"
                  : "New session"}
            </Badge>
          </div>
          {duplicate.duplicate ? (
            <Alert>
              <AlertTitle>This session is already in your history</AlertTitle>
              <AlertDescription>
                Saving will open the existing review instead of writing the same measured rows
                twice.
              </AlertDescription>
            </Alert>
          ) : null}
          {file.parsed.detectedDistanceUnit === "unknown" ? (
            <Field>
              <FieldLabel htmlFor="companion-distance-unit">Distance unit</FieldLabel>
              <Select
                value={distanceUnit}
                onValueChange={(value) => setDistanceUnit(value as "yards" | "meters")}
              >
                <SelectTrigger
                  id="companion-distance-unit"
                  className="h-11 w-full rounded-xl bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yards">Yards</SelectItem>
                  <SelectItem value="meters">Metres</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </CardContent>
      </Card>

      {unknownGroups.length > 0 ? (
        <Card data-uncertain-club-mappings>
          <CardHeader>
            <div>
              <CardTitle>Confirm uncertain clubs</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Correct matches were skipped. Only these rows need you.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {unknownGroups.map((group) => (
              <Field key={group.label}>
                <FieldLabel htmlFor={`club-mapping-${group.rowNumbers[0]}`}>
                  {group.label} · {group.rowNumbers.length} shots
                </FieldLabel>
                <FieldDescription>
                  Choose the club once for every listed source row.
                </FieldDescription>
                <Select
                  value={clubMappings[group.label] ?? ""}
                  onValueChange={(value) =>
                    setClubMappings((current) => ({ ...current, [group.label]: value }))
                  }
                >
                  <SelectTrigger
                    id={`club-mapping-${group.rowNumbers[0]}`}
                    className="h-11 w-full rounded-xl bg-background"
                  >
                    <SelectValue placeholder="Choose club" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatClubType(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {file.parsed.warnings.length > 0 ? (
        <Collapsible className="rounded-xl border bg-card px-4 py-2" data-validation-alert>
          <CollapsibleTrigger className="focus-aaa flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left text-sm font-semibold outline-none">
            Questionable rows ({file.parsed.warnings.length})
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Alert className="mb-2">
              <AlertTitle>Some rows need a cautious read</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-5 text-xs leading-5">
                  {file.parsed.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <Card
        size="sm"
        className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 gap-2 bg-card/95 py-2 shadow-lg backdrop-blur"
        aria-live="polite"
        data-import-sticky-footer
      >
        <CardContent className="grid gap-2 px-2">
          {progress !== "idle" ? (
            <OperationStatus
              status={
                progress === "error" ? "error" : progress === "queued" ? "success" : "working"
              }
              title={progressLabel(progress)}
              description={message ?? progressDescription(progress)}
              progress={progressPercent(progress)}
            />
          ) : null}
          <ButtonGroup className="w-full">
            <Button
              type="button"
              className="min-h-12 flex-1 rounded-xl text-base"
              onClick={save}
              disabled={!mappingsComplete || pending || !duplicate.checked}
            >
              {duplicate.duplicate ? "Open saved review" : "Save and build review"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 shrink-0"
              onClick={reset}
              disabled={pending}
            >
              Change file
            </Button>
          </ButtonGroup>
        </CardContent>
      </Card>
    </div>
  );
}

function navigateToImportResult(sessionId: string) {
  const destination = new URL("/import/result", window.location.origin);
  destination.searchParams.set("sessionId", sessionId);
  window.location.assign(destination);
}

function providerLabel(value: string) {
  if (value === "rapsodo") return "Rapsodo";
  if (value === "trackman") return "TrackMan";
  if (value === "square") return "Square Golf";
  return value;
}

function formatDate(value: string | null) {
  if (!value) return "Confirm on save";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function progressLabel(progress: SaveProgress) {
  if (progress === "checking") return "Checking data";
  if (progress === "saving") return "Saving shots and updating club numbers";
  if (progress === "building") return "Building your review";
  if (progress === "queued") return "Upload queued on this phone";
  if (progress === "error") return "Import needs attention";
  return "Ready";
}

function progressDescription(progress: SaveProgress) {
  if (progress === "checking") return "Confirming duplicate state before any write.";
  if (progress === "saving") return "Writing the measured rows and updating club evidence.";
  if (progress === "building") return "Preparing the immediate session review.";
  if (progress === "queued") return "Analysis will appear after this phone reconnects.";
  return undefined;
}

function progressPercent(progress: SaveProgress) {
  if (progress === "checking") return 30;
  if (progress === "saving") return 65;
  if (progress === "building") return 90;
  if (progress === "queued") return 100;
  return undefined;
}

function importWorkflowSteps({
  duplicateChecked,
  mappingsComplete,
  progress,
}: {
  duplicateChecked: boolean;
  mappingsComplete: boolean;
  progress: SaveProgress;
}): OperationStep[] {
  const saving = progress === "checking" || progress === "saving";
  const building = progress === "building";
  const failed = progress === "error";
  const queued = progress === "queued";
  return [
    { id: "file", label: "File", status: "complete" },
    {
      id: "validate",
      label: "Validate",
      status: duplicateChecked ? "complete" : failed ? "error" : "current",
    },
    {
      id: "mapping",
      label: "Map",
      status: mappingsComplete ? "complete" : "current",
    },
    {
      id: "save",
      label: "Save",
      status: building || queued ? "complete" : failed ? "error" : saving ? "current" : "upcoming",
    },
    {
      id: "review",
      label: "Review",
      status: building ? "current" : "upcoming",
    },
  ];
}
