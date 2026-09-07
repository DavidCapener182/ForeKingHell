export type RouteQuery = Record<string, string | string[] | undefined>;
/** Preserve repeated filters while giving the canonical route's required context precedence. */
export function canonicalRouteHref(
  pathname: string,
  query: RouteQuery = {},
  required: Record<string, string> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value)) for (const item of value) params.append(key, item);
  }
  for (const [key, value] of Object.entries(required)) params.set(key, value);
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
}
