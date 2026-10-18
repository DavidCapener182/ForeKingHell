import type { PerformanceShot, MetricStatus } from "@/lib/performance-intelligence";
import { clubSpeedMeasurementTrust } from "@/lib/club-speed-evidence";
import { normaliseSourceRawJson } from "@/lib/source-raw-json";
import { directionIsUsable, type SessionDataConfidence } from "@/lib/session-data-confidence";

export type PerformanceSourceRow = {
  id: string;
  clubId: string;
  sessionId: string;
  shotAt: Date;
  sessionDate: Date;
  carryYd: number | null;
  sideCarryYd: number | null;
  ballSpeedMph: number | null;
  clubSpeedMph: number | null;
  source: string;
  sessionType: string;
  playContext: string;
  shotPlayContext: string;
  shotCategory: string;
  qualityTag: string | null;
  reviewStatus: string;
  clubDataEstType: string | null;
  sourceRawJson: Record<string, string> | string;
  dataConfidence: SessionDataConfidence;
};
export type PerformanceEquipmentPeriod = {
  id: string;
  clubId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  ballModelId: string | null;
};

/** Only source metadata supplies context. A distance or a device price is never context evidence. */
export function performanceSourceContext(
  row: PerformanceSourceRow,
  equipment: PerformanceEquipmentPeriod[] = [],
): PerformanceShot {
  const raw = normaliseSourceRawJson(row.sourceRawJson);
  const field = (...keys: string[]) => {
    for (const key of keys) {
      const value = raw[key]?.trim();
      if (value) return value;
    }
    return null;
  };
  const periods = equipment.filter(
    (p) =>
      p.clubId === row.clubId &&
      p.effectiveFrom <= row.shotAt &&
      (!p.effectiveTo || row.shotAt < p.effectiveTo),
  );
  const period = periods.length === 1 ? periods[0] : null;
  const firmware = field("Firmware Version", "FirmwareVersion", "firmwareVersion");
  const app = field("App Version", "AppVersion", "appVersion");
  const device = field("Device Model", "DeviceModel", "deviceModel");
  const settings = field("Settings", "settings", "__lmwt_settingsKey");
  const swingIntent = field("__lmwtSwingIntent", "swingIntent", "shotIntent");
  const intentKey =
    swingIntent === "normal_ball"
      ? row.shotCategory
      : swingIntent === "maximum_ball"
        ? "maximum-effort"
        : swingIntent === "no_ball"
          ? "no-ball"
          : swingIntent
            ? "unknown"
            : undefined;
  const environment =
    row.shotPlayContext !== "unknown"
      ? row.shotPlayContext
      : row.playContext !== "unknown"
        ? row.playContext
        : field("Environment", "environment");
  const metricStatus: Partial<
    Record<"carryYd" | "ballSpeedMph" | "clubSpeedMph" | "sideCarryYd", MetricStatus>
  > = {};
  const metrics = ["carryYd", "ballSpeedMph", "clubSpeedMph", "sideCarryYd"] as const;
  const unresolvedProvenance = () => {
    for (const metric of metrics) metricStatus[metric] = "unknown";
  };
  try {
    const metadata: unknown = raw.__lmwtMetricProvenance
      ? JSON.parse(raw.__lmwtMetricProvenance)
      : null;
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const statuses = new Set<MetricStatus>([
        "measured",
        "estimated",
        "derived",
        "reconstructed",
        "unknown",
        "unavailable",
        "invalid",
      ]);
      for (const metric of metrics) {
        if (!Object.hasOwn(metadata, metric)) continue;
        const reading: unknown = (metadata as Record<string, unknown>)[metric];
        if (
          reading &&
          typeof reading === "object" &&
          "status" in reading &&
          statuses.has(reading.status as MetricStatus)
        )
          metricStatus[metric] = reading.status as MetricStatus;
        else metricStatus[metric] = "unknown";
      }
    } else if (Object.hasOwn(raw, "__lmwtMetricProvenance")) unresolvedProvenance();
  } catch {
    // An unreadable explicit record cannot be replaced with weaker legacy certainty.
    unresolvedProvenance();
  }
  // Older Rapsodo imports predate per-metric JSON but retain the manufacturer's
  // club-data flag. Reuse the same documented mapping as the CSV adapter; never
  // replace an explicit metric status or apply Rapsodo codes to another provider.
  if (row.clubDataEstType && !metricStatus.clubSpeedMph) {
    metricStatus.clubSpeedMph =
      row.source === "rapsodo" ? clubSpeedMeasurementTrust(row.clubDataEstType) : "unknown";
  }
  return {
    id: row.id,
    clubId: row.clubId,
    sessionId: row.sessionId,
    // Session dates establish comparison windows, retaining the original timestamp in storage.
    shotAt: row.sessionDate,
    carryYd: row.carryYd,
    sideCarryYd: row.sideCarryYd,
    ballSpeedMph: row.ballSpeedMph,
    clubSpeedMph: row.clubSpeedMph,
    source: row.source,
    sessionType: row.sessionType,
    canonicalSwingId: field("__lmwtCanonicalSwingId"),
    canonicalDuplicateConfirmed: raw.__lmwtCanonicalDuplicateConfirmed === "true",
    shotCategory: row.shotCategory,
    qualityTag: row.qualityTag,
    reviewStatus: row.reviewStatus,
    intentKey,
    equipmentId: period?.id ?? null,
    ballType: period?.ballModelId ?? field("Ball Type", "BallType", "ballType"),
    settingsKey:
      firmware || app || device || settings
        ? JSON.stringify({ firmware, app, device, settings })
        : null,
    environment,
    normalization: field("Normalization", "Normalisation", "Normalized", "normalization"),
    metricStatus,
    directionUsable: directionIsUsable(row.dataConfidence, row.id),
  };
}
