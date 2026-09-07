"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
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
  samples = {},
}: {
  files: ColumnMappingFile[];
  samples?: Record<string, string[]>;
  columnMapping: RapsodoColumnMapping;
  onColumnMappingChange: (mapping: RapsodoColumnMapping) => void;
}) {
  const analyses = useMemo(
    () =>
      files.map((file) => ({
        fileName: file.fileName,
        analysis: analyzeRapsodoCsvColumns(file.rawCsvText, { columnMapping }),
      })),
    [columnMapping, files],
  );
  const primaryAnalysis = analyses[0]?.analysis ?? null;
  const headers = useMemo(
    () => Array.from(new Set(primaryAnalysis?.headers ?? [])).filter(Boolean),
    [primaryAnalysis?.headers],
  );
  const suggestedMapping: RapsodoColumnMapping = primaryAnalysis?.suggestedMapping ?? {};
  const needsMapping = analyses.some(({ analysis }) => analysis.needsManualMapping);
  const hasSuggestions = Object.values(suggestedMapping).some(Boolean);
  const chosen = Object.values(columnMapping).filter(Boolean);
  const duplicates = chosen.filter((value, index) => chosen.indexOf(value) !== index);
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
    <Card className="shadow-sm" data-import-column-mapping>
      <CardHeader className="sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <CardTitle>Manual column mapping</CardTitle>
            <Badge variant={needsMapping ? "default" : "outline"}>
              {needsMapping ? "Mapping needed" : "Auto detected"}
            </Badge>
          </div>
          <CardDescription>
            If a Rapsodo export changes header names, map the first file&apos;s columns before
            previewing and saving.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasSuggestions ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11"
              onClick={() => onColumnMappingChange({ ...columnMapping, ...suggestedMapping })}
            >
              Apply suggestions
            </Button>
          ) : null}
          {hasMapping ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => onColumnMappingChange({})}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <details open={needsMapping || hasMapping}>
        <summary className="mx-4 min-h-11 cursor-pointer py-3 text-sm font-medium">
          {needsMapping ? "Review required mappings" : "Inspect column mappings and source samples"}
        </summary>
        <CardContent className="grid gap-3">
          {needsMapping ? (
            <p role="alert" className="text-sm text-destructive">
              A club column and at least one recognised measurement are required. Review the
              mappings below.
            </p>
          ) : null}
          {analyses.map(({ fileName, analysis }) =>
            analysis.warnings.length ? (
              <p key={fileName} className="break-words text-sm text-destructive">
                {fileName}: {analysis.warnings.join(" ")}
              </p>
            ) : null,
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {MAPPABLE_FIELDS.map((field) => (
              <UntitledSelect
                key={field}
                label={RAPSODO_COLUMN_FIELD_LABELS[field]}
                name={`column-map-${field}`}
                value={columnMapping[field] ?? AUTO_VALUE}
                onValueChange={(value) => setField(field, value)}
                options={[
                  { value: AUTO_VALUE, label: "Auto detect" },
                  ...headers.map((header) => ({
                    value: header,
                    label: header,
                    disabled: Object.entries(columnMapping).some(
                      ([key, value]) => key !== field && value === header,
                    ),
                  })),
                ]}
                error={
                  columnMapping[field] && duplicates.includes(columnMapping[field])
                    ? "This source column is mapped more than once."
                    : undefined
                }
                description={
                  columnMapping[field]
                    ? `Source: ${columnMapping[field]}. Sample: ${(samples[columnMapping[field]] ?? []).slice(0, 3).join(" · ") || "No sample values"}`
                    : suggestedMapping[field]
                      ? `Suggested source: ${suggestedMapping[field]}`
                      : "Uses the parser's detected source column."
                }
              />
            ))}
          </div>
          <FieldDescription>
            Header row: {primaryAnalysis?.headerRowNumber ?? "--"}. Mapping applies to this batch
            and is saved with queued offline imports.
          </FieldDescription>
        </CardContent>
      </details>
    </Card>
  );
}
