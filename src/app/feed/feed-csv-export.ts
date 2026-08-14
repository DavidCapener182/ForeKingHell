import type { FeedItemView } from "@/lib/social";
import { csvCell } from "@/lib/csv";

type FeedActivityExportItem = Pick<
  FeedItemView,
  | "headline"
  | "context"
  | "itemType"
  | "metricLabel"
  | "metricValue"
  | "verificationLabel"
  | "visibility"
  | "reactionCount"
  | "commentCount"
  | "createdAt"
  | "proofUrl"
  | "profile"
>;

const feedActivityExportHeaders = [
  "Activity",
  "Golfer",
  "Type",
  "Metric",
  "Proof",
  "Privacy",
  "Engagement",
  "Date",
  "Action",
] as const;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

export function buildFeedActivityCsv(items: FeedActivityExportItem[]) {
  const rows = items.map((item) => [
    item.context ? `${item.headline} ${item.context}` : item.headline,
    `${item.profile.displayName} @${item.profile.username}`,
    feedTypeLabel(item.itemType),
    item.metricValue ? `${item.metricLabel ?? "Metric"} · ${item.metricValue}` : "--",
    item.verificationLabel,
    titleCase(item.visibility),
    `${item.reactionCount} kudos · ${item.commentCount} comments`,
    dateFormatter.format(item.createdAt),
    item.proofUrl ?? `/profile/${item.profile.username}`,
  ]);

  return [feedActivityExportHeaders, ...rows]
    .map((row) => row.map((value) => csvCell(String(value))).join(","))
    .join("\n");
}

export function buildFeedActivityCsvHref(items: FeedActivityExportItem[]) {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(buildFeedActivityCsv(items))}`;
}

export function feedActivityExportFileName(activeFilter: string) {
  const safeFilter = activeFilter.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "all";
  return `forekinghell-feed-activity-${safeFilter}.csv`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function feedTypeLabel(value: string) {
  const labels: Record<string, string> = {
    rivalry_win: "Rivalry Win",
    squad_streak: "Squad Streak",
    weekly_pb: "Weekly PB",
  };

  if (labels[value]) {
    return labels[value];
  }

  return value
    .split("_")
    .map((part) => titleCase(part))
    .join(" ");
}
