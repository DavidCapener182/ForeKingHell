export type ContentExportSnapshot = {
  title: string;
  metricLabel: string;
  metricValue: string;
  context: string;
  footer: string;
  username: string;
  generatedAt: string;
};

export type FeedItemContentExportInput = {
  headline: string;
  metricLabel: string | null;
  metricValue: string | null;
  context: string | null;
  verificationLabel: string;
  profileUsername: string | null;
};

const TITLE_MAX_LENGTH = 150;
const METRIC_LABEL_MAX_LENGTH = 48;
const METRIC_VALUE_MAX_LENGTH = 40;
const CONTEXT_MAX_LENGTH = 180;
const FOOTER_MAX_LENGTH = 90;
const USERNAME_MAX_LENGTH = 40;

export function buildFeedItemContentExportSnapshot(
  input: FeedItemContentExportInput,
  generatedAt = new Date(),
): ContentExportSnapshot {
  const verificationLabel = cleanText(input.verificationLabel, "Verified import");
  const username = cleanUsername(input.profileUsername);

  return {
    title: cleanText(input.headline, "ForeKingHell highlight", TITLE_MAX_LENGTH),
    metricLabel: cleanText(input.metricLabel, "ForeKingHell", METRIC_LABEL_MAX_LENGTH),
    metricValue: cleanText(input.metricValue, verificationLabel, METRIC_VALUE_MAX_LENGTH),
    context: cleanText(input.context, verificationLabel, CONTEXT_MAX_LENGTH),
    footer: cleanText(`${verificationLabel} / @${username}`, verificationLabel, FOOTER_MAX_LENGTH),
    username,
    generatedAt: generatedAt.toISOString(),
  };
}

export function readContentExportSnapshot(value: unknown): ContentExportSnapshot {
  const record = isRecord(value) ? value : {};

  return {
    title: cleanText(record.title, "ForeKingHell highlight", TITLE_MAX_LENGTH),
    metricLabel: cleanText(record.metricLabel, "ForeKingHell", METRIC_LABEL_MAX_LENGTH),
    metricValue: cleanText(record.metricValue, "Verified", METRIC_VALUE_MAX_LENGTH),
    context: cleanText(record.context, "Verified launch-monitor data", CONTEXT_MAX_LENGTH),
    footer: cleanText(record.footer, "ForeKingHell", FOOTER_MAX_LENGTH),
    username: cleanUsername(record.username),
    generatedAt: cleanIsoDate(record.generatedAt),
  };
}

function cleanText(value: unknown, fallback: string, maxLength = 120) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const source = text || fallback;

  if (source.length <= maxLength) {
    return source;
  }

  const ellipsis = "...";
  const trimLength = Math.max(maxLength - ellipsis.length, 1);

  return `${source.slice(0, trimLength).trim()}${ellipsis}`;
}

function cleanUsername(value: unknown) {
  if (typeof value !== "string") {
    return "player";
  }

  return (
    value
      .trim()
      .replace(/^@+/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "")
      .slice(0, USERNAME_MAX_LENGTH) || "player"
  );
}

function cleanIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
