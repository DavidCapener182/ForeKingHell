"use client";

import type { RefObject } from "react";
import { FileText, Upload, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadDropzoneFile = {
  id: string;
  fileName: string;
  parsed: {
    shotCount: number;
    exportedAtIso: string | null;
    detectedDistanceUnit: string;
  };
};

type ReadProgress = {
  fileName: string;
  loaded: number;
  total: number;
} | null;

export function UploadDropzone({
  fileInputRef,
  isDragging,
  readProgress,
  files,
  setIsDragging,
  onFilesSelected,
  onClear,
  onRemoveFile,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  readProgress: ReadProgress;
  files: UploadDropzoneFile[];
  setIsDragging: (isDragging: boolean) => void;
  onFilesSelected: (files: FileList | File[]) => void | Promise<void>;
  onClear: () => void;
  onRemoveFile: (fileId: string) => void;
}) {
  return (
    <>
      <input
        ref={fileInputRef}
        className="hidden"
        id="csv-file"
        type="file"
        accept=".csv,text/csv"
        multiple
        onChange={(event) => {
          void onFilesSelected(event.target.files ?? []);
          event.currentTarget.value = "";
        }}
      />

      <div
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-white/70 px-4 py-8 text-center transition-colors",
          isDragging ? "border-emerald-500 bg-emerald-50" : "border-border hover:border-emerald-400",
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void onFilesSelected(event.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <div className="grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <UploadCloud className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Choose CSV files</p>
          <p className="text-sm text-muted-foreground">Click here or drop multiple CSVs at once.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          <Upload className="size-4" />
          Browse files
        </Button>
      </div>

      {readProgress ? (
        <div className="rounded-xl border bg-white p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Reading {readProgress.fileName}</span>
            <span className="text-muted-foreground">{formatPercent(readProgress.loaded, readProgress.total)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width]"
              style={{ width: formatPercent(readProgress.loaded, readProgress.total) }}
            />
          </div>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Selected files</p>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/90 px-3 py-2 ring-1 ring-slate-200/80"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-4 shrink-0 text-sky-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.parsed.shotCount} shots
                      {file.parsed.exportedAtIso ? `, ${formatDate(file.parsed.exportedAtIso)}` : ""}
                      , {file.parsed.detectedDistanceUnit} detected
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveFile(file.id)}
                  aria-label={`Remove ${file.fileName}`}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPercent(loaded: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.max(0, Math.round((loaded / total) * 100)))}%`;
}
