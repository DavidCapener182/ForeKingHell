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
  carrydistance: "carry_yards",
  total: "total_yards",
  totaldistance: "total_yards",
  offline: "offline_yards",
  sidedistance: "offline_yards",
  ballspeed: "ball_speed_mph",
  clubspeed: "club_speed_mph",
  launchangle: "launch_angle_deg",
  launchdirection: "launch_direction_deg",
  spinrate: "spin_rate_rpm",
  apex: "apex_feet",
  faceangle: "face_angle_deg",
  clubfaceangle: "face_angle_deg",
  smashfactor: "smash_factor",
};

export const squareProvider: LaunchMonitorProvider = {
  providerKind: "square",
  label: "Square Golf",
  status: "beta",
  async detect(input: ProviderInput) {
    const providerMarker = `${input.fileName ?? ""}\n${input.text.slice(0, 500)}`.toLowerCase();
    if (
      !providerMarker.includes("square") ||
      providerMarker.includes("trackman") ||
      providerMarker.includes("track man")
    ) {
      return false;
    }

    return detectGenericLaunchMonitorCsv(input, {
      providerKind: "square",
      headerHints: ["club", "carrydistance", "totaldistance", "ballspeed"],
      metricAliases,
    });
  },
  async parse(input: ProviderInput) {
    return parseGenericLaunchMonitorCsv(input, {
      providerKind: "square",
      headerHints: ["club", "carrydistance", "totaldistance", "ballspeed"],
      metricAliases,
    });
  },
  mapClub(rawClub: string | null) {
    return rawClub?.trim().toLowerCase().replace(/\s+/g, "-") || "unknown";
  },
  mapMetric(rawMetric: string) {
    return metricAliases[rawMetric.toLowerCase().replace(/[^a-z0-9]+/g, "")] ?? null;
  },
};
