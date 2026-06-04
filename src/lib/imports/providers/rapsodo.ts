import { parseRapsodoCsv } from "@/lib/rapsodo/parser";
import type {
  LaunchMonitorProvider,
  NormalizedMetric,
  ProviderInput,
} from "@/lib/imports/providers/types";

export const rapsodoProvider: LaunchMonitorProvider = {
  providerKind: "rapsodo",
  label: "Rapsodo",
  status: "live",
  async detect(input: ProviderInput) {
    const providerMarker = `${input.fileName ?? ""}\n${input.text.slice(0, 500)}`.toLowerCase();
    if (
      providerMarker.includes("square") ||
      providerMarker.includes("trackman") ||
      providerMarker.includes("track man")
    ) {
      return false;
    }

    const parsed = parseRapsodoCsv(input.text);
    return parsed.shotCount > 0;
  },
  async parse(input: ProviderInput) {
    const parsed = parseRapsodoCsv(input.text);
    return {
      providerKind: "rapsodo",
      sessionTitle: parsed.sessionTitle,
      shotCount: parsed.shotCount,
      rawHeaders: parsed.headers,
      warnings: parsed.warnings,
      shots: parsed.shots.map((shot) => ({
        shotNumber: shot.shotNumber,
        clubRaw: shot.clubTypeRaw,
        clubType: shot.clubType,
        raw: shot.sourceRawJson,
        warnings: shot.warnings,
        metrics: {
          carry_yards: shot.carryYd ?? undefined,
          total_yards: shot.totalYd ?? undefined,
          offline_yards: shot.sideCarryYd ?? undefined,
          ball_speed_mph: shot.ballSpeedMph ?? undefined,
          club_speed_mph: shot.clubSpeedMph ?? undefined,
          launch_angle_deg: shot.launchAngleDeg ?? undefined,
          launch_direction_deg: shot.launchDirectionDeg ?? undefined,
          spin_rate_rpm: shot.spinRate ?? undefined,
          spin_axis_deg: shot.spinAxis ?? undefined,
          apex_feet: shot.apexFt ?? undefined,
          descent_angle_deg: shot.descentAngleDeg ?? undefined,
          attack_angle_deg: shot.attackAngleDeg ?? undefined,
          club_path_deg: shot.clubPathDeg ?? undefined,
          face_angle_deg: shot.faceAngleDeg ?? undefined,
          smash_factor: shot.smashFactor ?? undefined,
        },
      })),
    };
  },
  mapClub(rawClub: string | null) {
    return rawClub?.trim().toLowerCase() || "unknown";
  },
  mapMetric(rawMetric: string): NormalizedMetric | null {
    const key = rawMetric.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const mappings: Record<string, NormalizedMetric> = {
      carrydistance: "carry_yards",
      totaldistance: "total_yards",
      sidecarry: "offline_yards",
      ballspeed: "ball_speed_mph",
      clubspeed: "club_speed_mph",
      launchangle: "launch_angle_deg",
      launchdirection: "launch_direction_deg",
      spinrate: "spin_rate_rpm",
      spinaxis: "spin_axis_deg",
      apex: "apex_feet",
      descentangle: "descent_angle_deg",
      attackangle: "attack_angle_deg",
      clubpath: "club_path_deg",
      faceangle: "face_angle_deg",
      clubfaceangle: "face_angle_deg",
      smashfactor: "smash_factor",
    };
    return mappings[key] ?? null;
  },
};
