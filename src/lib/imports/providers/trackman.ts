import { normalizeMetricReading, type MetricUnit } from "@/lib/metric-provenance";
import { normalizeHeader, numberFromCell, parseDelimitedRows } from "@/lib/imports/providers/types";
import type {
  LaunchMonitorProvider,
  NormalizedMetric,
  ProviderInput,
} from "@/lib/imports/providers/types";
import {
  detectGenericLaunchMonitorCsv,
  parseGenericLaunchMonitorCsv,
} from "@/lib/imports/providers/generic-csv";

const metricAliases: Record<string, NormalizedMetric> = {
  carry: "carry_yards",
  carryflat: "carry_yards",
  total: "total_yards",
  totaldistance: "total_yards",
  side: "offline_yards",
  offline: "offline_yards",
  ballspeed: "ball_speed_mph",
  clubspeed: "club_speed_mph",
  launchangle: "launch_angle_deg",
  launchdirection: "launch_direction_deg",
  spinrate: "spin_rate_rpm",
  spinaxis: "spin_axis_deg",
  height: "apex_feet",
  maxheight: "apex_feet",
  landingangle: "descent_angle_deg",
  attackangle: "attack_angle_deg",
  clubpath: "club_path_deg",
  faceangle: "face_angle_deg",
  clubfaceangle: "face_angle_deg",
  smashfactor: "smash_factor",
};

export const trackmanProvider: LaunchMonitorProvider = {
  providerKind: "trackman",
  label: "TrackMan",
  status: "research",
  async detect(input: ProviderInput) {
    const providerMarker = `${input.fileName ?? ""}\n${input.text.slice(0, 500)}`.toLowerCase();
    if (!providerMarker.includes("trackman") && !providerMarker.includes("track man")) {
      return false;
    }

    return detectGenericLaunchMonitorCsv(input, {
      providerKind: "trackman",
      headerHints: ["club", "carry", "ballspeed", "launchangle", "spinrate"],
      metricAliases,
    });
  },
  async parse(input: ProviderInput) {
    const aliases = { ...metricAliases };
    const headers =
      parseDelimitedRows(input.text).find((row) =>
        row.some((cell) => /^(?:height|apex|max ?height)\b/i.test(cell.trim())),
      ) ?? [];
    const apexHeaders = headers.filter((header) =>
      /^(?:height|apex|max ?height)\b/i.test(header.trim()),
    );
    for (const header of apexHeaders) aliases[normalizeHeader(header)] = "apex_feet";
    const session = parseGenericLaunchMonitorCsv(input, {
      providerKind: "trackman",
      headerHints: ["club", "carry", "ballspeed", "launchangle", "spinrate"],
      metricAliases: aliases,
    });
    for (const shot of session.shots) {
      const header = apexHeaders[0];
      if (!header) continue;
      const unit: MetricUnit = /\b(ft|feet|foot)\b/i.test(header)
        ? "ft"
        : /\b(yd|yds|yard|yards)\b/i.test(header)
          ? "yd"
          : /\b(m|meter|meters|metres)\b/i.test(header)
            ? "m"
            : "unknown";
      const apex = normalizeMetricReading({
        metric: "apexYd",
        value: numberFromCell(shot.raw[header]),
        unit,
        status: "measured",
        source: "trackman-csv",
        adapterVersion: "trackman-csv-v2",
        observationId: `row:${shot.rowNumber}`,
      });
      shot.raw.__lmwtMetricProvenance = JSON.stringify({ apexYd: apex });
      if (apex.value === null) {
        delete shot.metrics.apex_feet;
        const warning = `Row ${shot.rowNumber}: Apex unit is unknown or invalid; raw height is retained and comparisons are unavailable.`;
        shot.warnings.push(warning);
        session.warnings.push(warning);
      } else {
        shot.metrics.apex_feet = apex.value * 3;
      }
    }
    return session;
  },
  mapClub(rawClub: string | null) {
    return rawClub?.trim().toLowerCase().replace(/\s+/g, "-") || "unknown";
  },
  mapMetric(rawMetric: string) {
    return metricAliases[rawMetric.toLowerCase().replace(/[^a-z0-9]+/g, "")] ?? null;
  },
};
