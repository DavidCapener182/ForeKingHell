import type { LaunchMonitorProvider, NormalizedMetric, ProviderInput } from "@/lib/imports/providers/types";
import { detectGenericLaunchMonitorCsv, parseGenericLaunchMonitorCsv } from "@/lib/imports/providers/generic-csv";

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
    return parseGenericLaunchMonitorCsv(input, {
      providerKind: "trackman",
      headerHints: ["club", "carry", "ballspeed", "launchangle", "spinrate"],
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
