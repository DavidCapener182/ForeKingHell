"use client";
import type { RefObject } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  MAX_IMPORT_CSV_BYTES,
  MAX_IMPORT_FILES_PER_BATCH,
  formatMegabytes,
} from "@/lib/imports/import-limits";
import { cn } from "@/lib/utils";
type UploadDropzoneFile = {
  id: string;
  fileName: string;
  parsed: {
    shotCount: number;
    exportedAtIso: string | null;
    detectedDistanceUnit: string;
    warnings?: string[];
  };
};
type ReadProgress = { fileName: string; loaded: number; total: number } | null;
export function UploadDropzone({
  disabled = false,
  fileInputRef,
  isDragging,
  readProgress,
  files,
  setIsDragging,
  onFilesSelected,
  onClear,
  onRemoveFile,
  errors = [],
  onRetry,
  onDismissError,
}: {
  disabled?: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  readProgress: ReadProgress;
  files: UploadDropzoneFile[];
  setIsDragging: (value: boolean) => void;
  onFilesSelected: (files: FileList | File[]) => void | Promise<void>;
  onClear: () => void;
  onRemoveFile: (id: string) => void;
  errors?: Array<{ id: string; file: File; message: string }>;
  onRetry?: (file: File) => void | Promise<void>;
  onDismissError?: (id: string) => void;
}) {
  const reading = disabled || Boolean(readProgress);
  return (
    <div className="grid min-w-0 gap-3" data-import-upload-table>
      <input
        ref={fileInputRef}
        id="csv-file"
        className="hidden"
        type="file"
        disabled={reading}
        accept=".csv,text/csv"
        multiple
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.files ?? []);
          void onFilesSelected(selected);
          event.currentTarget.value = "";
        }}
      />
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!reading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!reading) void onFilesSelected(event.dataTransfer.files);
        }}
        className={cn(
          "grid min-w-0 place-items-center gap-3 rounded-xl border border-dashed bg-card p-5 text-center",
          isDragging && "border-primary bg-primary/5",
        )}
      >
        <UploadCloud className="size-8 text-primary" aria-hidden />
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          disabled={reading}
          onClick={() => fileInputRef.current?.click()}
        >
          Choose CSV files
        </Button>
        <p className="text-sm text-muted-foreground">
          Or drop files here. Up to {MAX_IMPORT_FILES_PER_BATCH} CSV files,{" "}
          {formatMegabytes(MAX_IMPORT_CSV_BYTES)} each.
        </p>
        <p className="text-xs text-muted-foreground">
          Use the scorecard image picker for photos when importing a simulated course.
        </p>
      </div>
      {readProgress ? (
        <div role="status" className="rounded-xl border border-border p-3">
          <p className="break-words text-sm">
            Reading {readProgress.fileName} · {percent(readProgress)}%
          </p>
          <Progress
            aria-label={`Reading ${readProgress.fileName}`}
            value={percent(readProgress)}
            className="mt-2 h-2"
          />
        </div>
      ) : null}
      {errors.map((error) => (
        <div role="alert" key={error.id} className="rounded-xl border border-destructive/40 p-3">
          <p className="break-words text-sm font-semibold">{error.file.name}</p>
          <p className="mt-1 text-sm text-destructive">{error.message}</p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={reading}
              onClick={() => void onRetry?.(error.file)}
            >
              Retry file
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => onDismissError?.(error.id)}
            >
              Dismiss error
            </Button>
          </div>
        </div>
      ))}
      {files.length ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Selected files · {files.length}</h3>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={reading}
              onClick={onClear}
            >
              Clear batch
            </Button>
          </div>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {files.map((file) => (
              <li key={file.id} className="min-w-0 p-3">
                <div className="flex items-start gap-2">
                  <FileText size={18} className="mt-1 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold">{file.fileName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {file.parsed.shotCount} shots · {file.parsed.detectedDistanceUnit} ·{" "}
                      {file.parsed.exportedAtIso
                        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
                            new Date(file.parsed.exportedAtIso),
                          )
                        : "Date not detected"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-11 shrink-0"
                    aria-label={`Remove ${file.fileName}`}
                    onClick={() => onRemoveFile(file.id)}
                  >
                    <X size={16} />
                  </Button>
                </div>
                {file.parsed.warnings?.length ? (
                  <details className="mt-2">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm">
                      {file.parsed.warnings.length} parse warnings
                    </summary>
                    <ul className="list-disc space-y-1 pl-5 text-xs">
                      {file.parsed.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
function percent(progress: NonNullable<ReadProgress>) {
  return progress.total > 0
    ? Math.min(100, Math.max(0, Math.round((progress.loaded / progress.total) * 100)))
    : 0;
}
