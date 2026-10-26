import { findRouteMetadata } from "@/components/app/route-metadata";

// Saved destinations outlive changes to which sections are shown as primary tabs.
const savedSections = [
  { section: "today", href: "/today", group: "today" },
  { section: "sessions", href: "/sessions", group: "review" },
  { section: "practice", href: "/practice", group: "practice" },
  { section: "play", href: "/play", group: "strategy" },
  { section: "bag", href: "/bag", group: "bag" },
];

/** The worker returns an offline document at the failed request URL, not just /offline. */
export function offlineDestination(url: URL) {
  const explicit = url.pathname === "/offline" ? url.searchParams.get("section") : null;
  const selected = savedSections.find((item) => item.section === explicit);
  if (selected) return { section: selected.section, target: selected.href };
  let targetUrl = url;
  if (url.pathname === "/surface/companion") {
    const next = url.searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      const candidate = new URL(next, url.origin);
      if (candidate.origin === url.origin) targetUrl = candidate;
    }
  }
  const group = findRouteMetadata(targetUrl.pathname)?.mobilePrimaryGroup;
  const item = savedSections.find((candidate) => candidate.group === group);
  return {
    section: item?.section ?? "today",
    target: item ? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}` : "/today",
  };
}
