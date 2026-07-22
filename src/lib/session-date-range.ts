export function validSessionDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatSessionDateRange(earliestValue: unknown, latestValue: unknown) {
  const earliestDate = validSessionDate(earliestValue);
  const latestDate = validSessionDate(latestValue);
  if (!earliestDate || !latestDate) return "No measured date range yet";

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const earliest = formatter.format(earliestDate);
  const latest = formatter.format(latestDate);
  return earliest === latest ? earliest : `${earliest} – ${latest}`;
}
