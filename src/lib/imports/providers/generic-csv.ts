import {
  normalizeHeader,
  numberFromCell,
  parseDelimitedRows,
  type LaunchMonitorProviderKind,
  type NormalizedMetric,
  type NormalizedSession,
  type ProviderInput,
} from "@/lib/imports/providers/types";

export type GenericProviderConfig = {
  providerKind: LaunchMonitorProviderKind;
  headerHints: string[];
  metricAliases: Record<string, NormalizedMetric>;
};

export function detectGenericLaunchMonitorCsv(input: ProviderInput, config: GenericProviderConfig) {
  const rows = parseDelimitedRows(input.text);
  const header = rows.find((row) => row.length >= 4) ?? [];
  const normalisedHeaders = header.map(normalizeHeader);
  return config.headerHints.some((hint) => normalisedHeaders.includes(hint));
}

export function parseGenericLaunchMonitorCsv(input: ProviderInput, config: GenericProviderConfig): NormalizedSession {
  const rows = parseDelimitedRows(input.text);
  const headerIndex = rows.findIndex((row) => row.map(normalizeHeader).some((header) => config.metricAliases[header]));
  const headers = headerIndex >= 0 ? rows[headerIndex] : [];
  const normalisedHeaders = headers.map(normalizeHeader);
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : [];
  const warnings: string[] = [];

  if (headerIndex < 0) {
    warnings.push(`${config.providerKind} headers were not detected.`);
  }

  const shots = dataRows
    .filter((row) => row.some(Boolean))
    .map((row, index) => {
      const raw = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex] ?? ""]));
      const metrics: NormalizedSession["shots"][number]["metrics"] = {};

      normalisedHeaders.forEach((header, cellIndex) => {
        const metric = config.metricAliases[header];
        const value = numberFromCell(row[cellIndex]);

        if (metric && value !== null) {
          metrics[metric] = value;
        }
      });

      const clubRaw = cellByHeader(row, normalisedHeaders, ["club", "clubtype", "clubname"]);

      return {
        shotNumber: numberFromCell(cellByHeader(row, normalisedHeaders, ["shot", "shotnumber", "shotno"])) ?? index + 1,
        clubRaw,
        clubType: normaliseClub(clubRaw),
        metrics,
        raw,
        warnings: Object.keys(metrics).length === 0 ? ["No mapped metrics found for this row."] : [],
      };
    });

  return {
    providerKind: config.providerKind,
    sessionTitle: input.fileName ?? null,
    shotCount: shots.length,
    shots,
    rawHeaders: headers,
    warnings,
  };
}

function cellByHeader(row: string[], headers: string[], candidates: string[]) {
  const index = headers.findIndex((header) => candidates.includes(header));
  return index >= 0 ? row[index] ?? null : null;
}

function normaliseClub(value: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, "-") || "unknown";
}
