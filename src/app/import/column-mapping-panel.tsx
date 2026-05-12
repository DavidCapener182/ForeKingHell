"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RAPSODO_COLUMN_FIELD_LABELS,
  analyzeRapsodoCsvColumns,
  type RapsodoColumnField,
  type RapsodoColumnMapping,
} from "@/lib/rapsodo/parser";

const AUTO_VALUE = "__auto__";
const MAPPABLE_FIELDS: RapsodoColumnField[] = [
  "clubType",
  "carryDistance",
  "totalDistance",
  "ballSpeed",
  "launchAngle",
  "launchDirection",
  "sideCarry",
  "apex",
  "shotNumber",
  "clubBrand",
  "clubModel",
  "clubSpeed",
  "smashFactor",
  "descentAngle",
  "attackAngle",
  "clubPath",
  "spinRate",
  "spinAxis",
  "shotShape",
];

type ColumnMappingFile = {
  fileName: string;
  rawCsvText: string;
};

export function ColumnMappingPanel({
  files,
  columnMapping,
  onColumnMappingChange,
}: {
  files: ColumnMappingFile[];
  columnMapping: RapsodoColumnMapping;
  onColumnMappingChange: (mapping: RapsodoColumnMapping) => void;
}) {
  const analyses = useMemo(
    () => files.map((file) => ({ fileName: file.fileName, analysis: analyzeRapsodoCsvColumns(file.rawCsvText, { columnMapping }) })),
    [columnMapping, files],
  );
  const primaryAnalysis = analyses[0]?.analysis ?? null;
  const headers = useMemo(
    () => Array.from(new Set(primaryAnalysis?.headers ?? [])).filter(Boolean),
    [primaryAnalysis?.headers],
  );
  const suggestedMapping = primaryAnalysis?.suggestedMapping ?? {};
  const needsMapping = analyses.some(({ analysis }) => analysis.needsManualMapping);
  const hasSuggestions = Object.values(suggestedMapping).some(Boolean);
  const hasMapping = Object.values(columnMapping).some((value) => Boolean(value?.trim()));

  if (files.length === 0 || headers.length === 0) {
    return null;
  }

  function setField(field: RapsodoColumnField, value: string) {
    const nextMapping = { ...columnMapping };

    if (value === AUTO_VALUE) {
      delete nextMapping[field];
    } else {
      nextMapping[field] = value;
    }

    onColumnMappingChange(nextMapping);
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-emerald-700" />
            <p className="text-sm font-semibold">Manual column mapping</p>
            <Badge variant={needsMapping ? "default" : "outline"}>
              {needsMapping ? "Mapping needed" : "Auto detected"}
            </Badge>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            If a Rapsodo export changes header names, map the first file&apos;s columns before previewing and saving.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasSuggestions ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onColumnMappingChange({ ...columnMapping, ...suggestedMapping })}
            >
              Apply suggestions
            </Button>
          ) : null}
          {hasMapping ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onColumnMappingChange({})}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {MAPPABLE_FIELDS.map((field) => (
          <div key={field} className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`column-map-${field}`}>
              {RAPSODO_COLUMN_FIELD_LABELS[field]}
            </label>
            <Select value={columnMapping[field] ?? AUTO_VALUE} onValueChange={(value) => setField(field, value)}>
              <SelectTrigger id={`column-map-${field}`} className="h-9 w-full text-xs">
                <SelectValue placeholder="Auto detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_VALUE}>Auto detect</SelectItem>
                {headers.map((header) => (
                  <SelectItem key={`${field}-${header}`} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Header row: {primaryAnalysis?.headerRowNumber ?? "--"}. Mapping applies to this batch and is saved with queued offline imports.
      </p>
    </div>
  );
}
