"use client";

import type { RefObject } from "react";
import { FileText, Upload, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GolfLoader } from "@/components/visuals/golf-loader";
import { PageArtwork } from "@/components/visuals/page-artwork";
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
          const files = Array.from(event.currentTarget.files ?? []);
          void onFilesSelected(files);
          event.currentTarget.value = "";
        }}
      />

      <Card
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed px-4 py-8 text-center shadow-sm transition-colors",
          isDragging ? "border-primary bg-primary/5" : "hover:border-primary/60 hover:bg-muted/20",
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
        {files.length === 0 ? (
          <PageArtwork
            variant="import"
            alt=""
            className="mb-1 h-28 w-full rounded-xl"
            sizes="(min-width: 768px) 520px, 0px"
          />
        ) : null}
        <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Choose CSV files</p>
          <p className="text-sm text-muted-foreground">Click here or drop multiple CSVs at once.</p>
        </div>
        <Badge variant="secondary" className="h-8 gap-1.5 px-3">
          <Upload className="size-4" />
          Browse files
        </Badge>
      </Card>

      {readProgress ? (
        <Card className="p-3 shadow-sm" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Reading {readProgress.fileName}</span>
            <span className="text-muted-foreground">
              {formatPercent(readProgress.loaded, readProgress.total)}
            </span>
          </div>
          <GolfLoader
            label="Reading launch data"
            className="mt-3 max-w-none border-0 bg-primary/5 p-3 shadow-none [&_[data-loader-art]]:h-20"
          />
          <Progress
            value={progressValue(readProgress.loaded, readProgress.total)}
            className="mt-2 h-2"
          />
        </Card>
      ) : null}

      {files.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Selected files</p>
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          </div>
          <Card className="overflow-hidden py-0 shadow-none" data-import-upload-table>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="text-right">Shots</TableHead>
                  <TableHead>Exported</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-primary" />
                        <span className="max-w-64 truncate">{file.fileName}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {file.parsed.shotCount}
                    </TableCell>
                    <TableCell>
                      {file.parsed.exportedAtIso ? formatDate(file.parsed.exportedAtIso) : "—"}
                    </TableCell>
                    <TableCell>{file.parsed.detectedDistanceUnit}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveFile(file.id)}
                        aria-label={`Remove ${file.fileName}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
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

  return `${progressValue(loaded, total)}%`;
}

function progressValue(loaded: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
}
