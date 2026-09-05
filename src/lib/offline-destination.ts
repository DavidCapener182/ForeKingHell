import { mobilePrimaryItems } from "@/components/app/nav-items";

/** The worker returns an offline document at the failed request URL, not just /offline. */
export function offlineDestination(url: URL) {
  const explicit = url.pathname === "/offline" ? url.searchParams.get("section") : null;
  const selected = mobilePrimaryItems.find((item) => item.href.slice(1) === explicit);
  if (selected) return { section: selected.href.slice(1), target: selected.href };
  let targetUrl = url;
  if (url.pathname === "/surface/companion") {
    const next = url.searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      const candidate = new URL(next, url.origin);
      if (candidate.origin === url.origin) targetUrl = candidate;
    }
  }
  const item = mobilePrimaryItems.find((candidate) => candidate.isActive(targetUrl.pathname));
  return {
    section: item?.href.slice(1) ?? "today",
    target: item ? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}` : "/today",
  };
}
