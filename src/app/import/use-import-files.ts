"use client";

import { useMemo, useState } from "react";

import type { UploadedCsv } from "@/app/import/import-types";
import {
  type DistanceUnit,
  type RapsodoColumnMapping,
  parseRapsodoCsv,
} from "@/lib/rapsodo/parser";

export function useImportFiles(distanceUnit: DistanceUnit, columnMapping: RapsodoColumnMapping) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedCsv[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [readProgress, setReadProgress] = useState<{
    fileName: string;
    loaded: number;
    total: number;
  } | null>(null);

  const parsedFiles = useMemo(
    () =>
      uploadedFiles.map((file) => ({
        ...file,
        parsed: parseRapsodoCsv(file.rawCsvText, {
          fallbackDistanceUnit: distanceUnit,
          columnMapping,
        }),
      })),
    [columnMapping, distanceUnit, uploadedFiles],
  );

  async function readSelectedFiles(files: FileList | File[]) {
    const csvFiles = Array.from(files).filter((file) => {
      const name = file.name.toLowerCase();
      return (
        name.endsWith(".csv") ||
        file.type === "text/csv" ||
        file.type === "application/vnd.ms-excel"
      );
    });

    if (csvFiles.length === 0) {
      return;
    }

    const nextFiles: UploadedCsv[] = [];

    try {
      for (const [index, file] of csvFiles.entries()) {
        const rawCsvText = await readFileAsTextWithProgress(file, (loaded, total) => {
          setReadProgress({ fileName: file.name, loaded, total });
        });

        nextFiles.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
          fileName: file.name,
          fileSizeBytes: file.size,
          rawCsvText,
        });
      }
    } finally {
      setReadProgress(null);
    }

    setUploadedFiles((currentFiles) => {
      const existingIds = new Set(currentFiles.map((file) => file.id));
      return [...currentFiles, ...nextFiles.filter((file) => !existingIds.has(file.id))];
    });
  }

  function removeFile(fileId: string) {
    setUploadedFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  }

  function clearFiles() {
    setUploadedFiles([]);
  }

  return {
    uploadedFiles,
    parsedFiles,
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
