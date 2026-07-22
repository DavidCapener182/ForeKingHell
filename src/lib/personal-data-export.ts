import { createHash } from "node:crypto";

import { exportRulesForGovernance, governanceForDataset } from "@/lib/data-governance-manifest";

export const personalDataExportSchemaVersion = "2026-07-21";

type ExportRow = Record<string, unknown>;

type PersonalDataExportInput = {
  userId: string;
  exportedAt?: Date;
  profile: ExportRow | null;
  data: Record<string, unknown>;
};

export function createPersonalDataExport({
  userId,
  exportedAt = new Date(),
  profile,
  data,
}: PersonalDataExportInput) {
  const scopedData = Object.fromEntries(
    Object.entries(data).map(([dataset, value]) => [
      dataset,
      scopeAndRedactDataset(dataset, value, userId),
    ]),
  );

  const exportDocument = {
    schemaVersion: personalDataExportSchemaVersion,
    scope: "personal" as const,
    exportedAt: exportedAt.toISOString(),
    userId,
    profile,
    data: scopedData,
    manifest: Object.entries(scopedData).map(([dataset, value]) => ({
      dataset,
      rowCount: Array.isArray(value) ? value.length : value === null ? 0 : 1,
      containsSensitiveData: governanceForDataset(dataset)?.containsSensitiveData ?? true,
    })),
  };

  return {
    ...exportDocument,
    checksum: {
      algorithm: "sha256" as const,
      value: createHash("sha256").update(JSON.stringify(exportDocument)).digest("hex"),
    },
  };
}

function scopeAndRedactDataset(dataset: string, value: unknown, userId: string) {
  const governance = governanceForDataset(dataset);
  if (!governance || !governance.export) {
    return [];
  }

  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .filter((row): row is ExportRow => {
      if (!isExportRow(row)) {
        return false;
      }

      const exportRules = exportRulesForGovernance(governance);

      return exportRules.some(
        (rule) =>
          row[rule.ownerField] === userId &&
          (!rule.requiredField ||
            !rule.allowedValues ||
            rule.allowedValues.includes(String(row[rule.requiredField] ?? ""))),
      );
    })
    .map((row) => omitFields(row, governance.redactedFields));
}

function omitFields(row: ExportRow, fields: string[]) {
  if (fields.length === 0) {
    return row;
  }

  const redacted = { ...row };
  for (const field of fields) {
    delete redacted[field];
  }

  return redacted;
}

function isExportRow(value: unknown): value is ExportRow {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
