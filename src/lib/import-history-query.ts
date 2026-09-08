export type ImportHistoryParams = Record<string, string | string[] | undefined>;
export type ImportHistoryQuery = {
  q: string;
  status: string;
  source: string;
  order: "newest" | "oldest";
};
export function parseImportHistoryQuery(params: ImportHistoryParams): ImportHistoryQuery {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  };
  return {
    q: first("importQ").trim().slice(0, 260),
    status: first("importStatus").slice(0, 32) || "active",
    source: first("importSource").slice(0, 40),
    order: first("importOrder") === "oldest" ? "oldest" : "newest",
  };
}
export function importHistoryHref(params: ImportHistoryParams, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value])
      query.append(key, entry);
  }
  query.set("importPage", String(page));
  return `/import?${query}#import-library`;
}
