export type SanitizedCspViolation = {
  blockedCategory: "blob" | "cross_origin" | "data" | "eval" | "inline" | "same_origin" | "unknown";
  directive: string;
  disposition: "enforce" | "report" | "unknown";
};

const MAX_REPORTS_PER_REQUEST = 5;

export function sanitizeCspReports(
  payload: unknown,
  applicationOrigin: string,
): SanitizedCspViolation[] {
  const candidates = Array.isArray(payload) ? payload.slice(0, MAX_REPORTS_PER_REQUEST) : [payload];

  return candidates.flatMap((candidate) => {
    const envelope = record(candidate);
    const report = record(envelope?.["csp-report"] ?? envelope?.body);
    if (!report) return [];

    const directive = safeDirective(
      stringValue(report["effective-directive"]) ??
        stringValue(report.effectiveDirective) ??
        stringValue(report["violated-directive"]),
    );
    if (!directive) return [];

    const blockedResource =
      stringValue(report["blocked-uri"]) ?? stringValue(report.blockedURL) ?? "";
    const disposition = safeDisposition(
      stringValue(report.disposition) ?? stringValue(envelope?.disposition),
    );

    return [
      {
        blockedCategory: blockedCategory(blockedResource, applicationOrigin),
        directive,
        disposition,
      },
    ];
  });
}

function blockedCategory(
  value: string,
  applicationOrigin: string,
): SanitizedCspViolation["blockedCategory"] {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "unknown";
  if (normalized === "inline") return "inline";
  if (normalized === "eval") return "eval";
  if (normalized === "data" || normalized.startsWith("data:")) return "data";
  if (normalized === "blob" || normalized.startsWith("blob:")) return "blob";

  try {
    const blocked = new URL(value, applicationOrigin);
    if (!["http:", "https:"].includes(blocked.protocol)) return "unknown";
    return blocked.origin === new URL(applicationOrigin).origin ? "same_origin" : "cross_origin";
  } catch {
    return "unknown";
  }
}

function safeDirective(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return /^[a-z][a-z0-9-]{0,79}$/.test(normalized) ? normalized : null;
}

function safeDisposition(value: string | null): SanitizedCspViolation["disposition"] {
  return value === "enforce" || value === "report" ? value : "unknown";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
