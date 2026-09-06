"use client";

import { useEffect, useState, useRef } from "react";

import type { UploadedCsv } from "@/app/import/import-types";
import { type DistanceUnit, type RapsodoColumnMapping } from "@/lib/rapsodo/parser";
import {
  parseLaunchMonitorImportCsv,
  type ParsedLaunchMonitorImportResult,
} from "@/lib/imports/normalized-import";

export type ParsedImportFile = UploadedCsv & {
  parsed: ParsedLaunchMonitorImportResult;
};

export function useImportFiles(distanceUnit: DistanceUnit, columnMapping: RapsodoColumnMapping) {
  const [fileErrors, setFileErrors] = useState<Array<{ id: string; file: File; message: string }>>(
    [],
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const generation = useRef(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedCsv[]>([]);
  const [parsedFiles, setParsedFiles] = useState<ParsedImportFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [readProgress, setReadProgress] = useState<{
    fileName: string;
    loaded: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function parseFiles() {
      setIsParsing(true);
      setParseError(null);
      try {
        const nextFiles = await Promise.all(
          uploadedFiles.map(async (file) => ({
            ...file,
            parsed: await parseLaunchMonitorImportCsv({
              rawCsvText: file.rawCsvText,
              fileName: file.fileName,
              fallbackDistanceUnit: distanceUnit,
              columnMapping,
            }),
          })),
        );

        if (!cancelled) {
          setParsedFiles(nextFiles);
        }
      } catch (error) {
        if (!cancelled) {
          setParsedFiles([]);
          setParseError(
            error instanceof Error
              ? error.message
              : "Could not parse the selected files. Review mappings or choose the files again.",
          );
        }
      } finally {
        if (!cancelled) setIsParsing(false);
      }
    }

    void parseFiles();

    return () => {
      cancelled = true;
    };
  }, [columnMapping, distanceUnit, uploadedFiles]);

  async function readSelectedFiles(files: FileList | File[]) {
    const currentGeneration = generation.current;
    const csvFiles = Array.from(files);
    const nextFiles: UploadedCsv[] = [];

    try {
      for (const file of csvFiles) {
        const id = `${file.name}-${file.size}-${file.lastModified}`;
        setFileErrors((current) => current.filter((error) => error.id !== id));
        if (!file.name.toLowerCase().endsWith(".csv")) {
          setFileErrors((current) => [
            ...current,
            {
              id,
              file,
              message:
                "Unsupported file. Choose a CSV export; scorecard images belong in the scorecard picker.",
            },
          ]);
          continue;
        }
        try {
          const rawCsvText = await readFileAsTextWithProgress(file, (loaded, total) => {
            setReadProgress({ fileName: file.name, loaded, total });
          });

          nextFiles.push({
            id,
            fileName: file.name,
            fileSizeBytes: file.size,
            rawCsvText,
          });
        } catch (error) {
          setFileErrors((current) => [
            ...current,
            {
              id,
              file,
              message:
                error instanceof Error ? error.message : "File could not be read. Try again.",
            },
          ]);
        }
      }
    } finally {
      setReadProgress(null);
    }

    if (currentGeneration !== generation.current) return;
    setUploadedFiles((currentFiles) => {
      const existingIds = new Set(currentFiles.map((file) => file.id));
      return [...currentFiles, ...nextFiles.filter((file) => !existingIds.has(file.id))];
    });
  }

  function removeFile(fileId: string) {
    setUploadedFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  }

  function clearFiles() {
    generation.current += 1;
    setFileErrors([]);
    setUploadedFiles([]);
    setParsedFiles([]);
  }

  return {
    uploadedFiles,
    parsedFiles,
    fileErrors,
    parseError,
    isParsing,
    dismissFileError: (id: string) =>
      setFileErrors((current) => current.filter((error) => error.id !== id)),
    isDragging,
    readProgress,
    setIsDragging,
    readSelectedFiles,
    removeFile,
    clearFiles,
  };
}

function readFileAsTextWithProgress(
  file: File,
  onProgress: (loaded: number, total: number) => void,
) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      onProgress(event.loaded, event.total || file.size);
    };
    reader.onload = () => {
      onProgress(file.size, file.size);
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error(`Could not read ${file.name}.`));
      }
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsText(file);
  });
}
