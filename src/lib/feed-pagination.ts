export type FeedScope = "following" | "friends" | "groups" | "achievements" | "me" | "all";
export type FeedPageOptions = {
  filter?: FeedScope;
  query?: string;
  from?: string;
  to?: string;
  after?: string;
  before?: string;
};
export type FeedCursor = { createdAt: string; id: string };
export function validFeedDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}
export function encodeFeedCursor(cursor: FeedCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
export function decodeFeedCursor(value?: string): FeedCursor | null {
  if (!value || value.length > 400) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return typeof cursor.createdAt === "string" &&
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(
        cursor.createdAt,
      ) &&
      Boolean(validFeedDate(cursor.createdAt.slice(0, 10))) &&
      Number.isFinite(Date.parse(cursor.createdAt)) &&
      typeof cursor.id === "string" &&
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(cursor.id)
      ? { createdAt: cursor.createdAt, id: cursor.id }
      : null;
  } catch {
    return null;
  }
}
export function feedPageHref(options: FeedPageOptions) {
  const params = new URLSearchParams();
  if (options.filter) params.set("filter", options.filter);
  if (options.query) params.set("q", options.query);
  for (const key of ["from", "to", "after", "before"] as const)
    if (options[key]) params.set(key, options[key]!);
  return `/feed${params.size ? `?${params}` : ""}`;
}
