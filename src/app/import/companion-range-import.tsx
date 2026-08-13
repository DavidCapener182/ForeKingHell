"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, FileUp } from "lucide-react";

import { saveRapsodoImportAction } from "@/app/import/actions";
import { useImportFiles } from "@/app/import/use-import-files";
import { OperationStatus } from "@/components/app/operation-status";
import { OperationStepper, type OperationStep } from "@/components/app/operation-stepper";
import {
  IOSGroupedList,
  IOSInlineStatus,
  IOSListRow,
  IOSMetricRow,
} from "@/components/app/ios-mobile";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <section className="ios-grouped-list grid gap-4 p-5" data-companion-csv-import>
        <input
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Import a session
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Choose a range CSV</h1>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Pick one launch-monitor export. It is checked on this phone before anything is saved.
          </p>
        </div>
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
              readProgress.total > 0 ? (readProgress.loaded / readProgress.total) * 100 : undefined
            }
          />
        ) : null}
        {message ? (
          <OperationStatus
            status="error"
            title="This file cannot be imported"
            description={message}
          />
        ) : null}
      </section>
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
      <section className="ios-grouped-list grid gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Ready to save
            </p>
            <h1 className="mt-1 truncate text-xl font-bold">{file.fileName}</h1>
          </div>
          <IOSInlineStatus
            label={unknownGroups.length === 0 ? "Clubs matched" : "Check clubs"}
            tone={unknownGroups.length === 0 ? "positive" : "attention"}
          />
        </div>
        <IOSGroupedList label="Parsed session summary" className="bg-card">
          <IOSMetricRow label="Provider" value={providerLabel(file.parsed.source)} />
          <IOSMetricRow label="Session date" value={formatDate(file.parsed.exportedAtIso)} />
          <IOSMetricRow label="Session type" value="Range practice" />
          <IOSMetricRow label="Shots" value={String(file.parsed.shotCount)} />
          <IOSMetricRow label="Clubs" value={clubs.join(", ") || "Needs mapping"} />
          <IOSMetricRow
            label="Distance unit"
            value={
              file.parsed.detectedDistanceUnit === "unknown"
                ? distanceUnit
                : file.parsed.detectedDistanceUnit
            }
          />
          <IOSMetricRow label="Excluded rows" value={String(excludedRows)} />
          <IOSListRow
            label="Duplicate check"
            value={
              !duplicate.checked
                ? "Checking…"
                : duplicate.duplicate
                  ? "Already imported"
                  : "New session"
            }
            status={
              duplicate.checked ? (
                <IOSInlineStatus
                  label={duplicate.duplicate ? "Duplicate" : "Checked"}
                  tone={duplicate.duplicate ? "attention" : "positive"}
                />
              ) : undefined
            }
          />
        </IOSGroupedList>
        {file.parsed.detectedDistanceUnit === "unknown" ? (
          <div className="grid gap-2 text-sm font-semibold">
            <span>Distance unit</span>
            <Select
              value={distanceUnit}
              onValueChange={(value) => setDistanceUnit(value as "yards" | "meters")}
            >
              <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yards">Yards</SelectItem>
                <SelectItem value="meters">Metres</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </section>

      {unknownGroups.length > 0 ? (
        <section className="ios-grouped-list grid gap-3 p-4" data-uncertain-club-mappings>
          <div>
            <h2 className="font-semibold">Confirm uncertain clubs</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Correct matches were skipped. Only these rows need you.
            </p>
          </div>
          {unknownGroups.map((group) => (
            <div key={group.label} className="grid gap-1.5 text-sm font-semibold">
              <span>
                {group.label} · {group.rowNumbers.length} shots
              </span>
              <Select
                value={clubMappings[group.label] ?? ""}
                onValueChange={(value) =>
                  setClubMappings((current) => ({ ...current, [group.label]: value }))
                }
              >
                <SelectTrigger className="h-11 w-full rounded-xl bg-background">
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
            </div>
          ))}
        </section>
      ) : null}

      {file.parsed.warnings.length > 0 ? (
        <Collapsible className="ios-grouped-list px-4 py-2" data-validation-alert>
          <CollapsibleTrigger className="focus-aaa flex min-h-11 w-full items-center justify-between gap-2 py-2 text-left text-sm font-semibold outline-none">
            Questionable rows ({file.parsed.warnings.length})
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <OperationStatus
              status="warning"
              title="Some rows need a cautious read"
              description={
                <ul className="list-disc space-y-1 pl-5 text-xs leading-5">
                  {file.parsed.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              }
              className="mb-2"
            />
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <section
        className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 grid gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur"
        aria-live="polite"
        data-import-sticky-footer
      >
        {progress !== "idle" ? (
          <OperationStatus
            status={progress === "error" ? "error" : progress === "queued" ? "success" : "working"}
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
      </section>
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
