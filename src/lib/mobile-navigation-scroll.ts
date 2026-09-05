const prefix = "fkh:mobile-tab-scroll:";
const roots = new Set(["/today", "/practice", "/play", "/progress", "/bag"]);
const historyField = "__fkhMobileScroll";

/** Match useSearchParams serialization, including spaces in mobile search deep links. */
export function mobileNavigationLocation(href: string) {
  const url = new URL(href, "https://companion.local");
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

export function mobileHistoryScrollKey(location: string, state = window.history.state) {
  const entry = state?.[historyField];
  return entry?.location === location && typeof entry.id === "string"
    ? `${prefix}history:${entry.id}`
    : null;
}

export function createMobileHistoryEntry(location: string) {
  const id = crypto.randomUUID();
  const key = `${prefix}history:${id}`;
  preserveMobileHistoryEntry(location, key);
  return key;
}

export function preserveMobileHistoryEntry(location: string, key: string) {
  if (mobileHistoryScrollKey(location) === key) return;
  const id = key.slice(`${prefix}history:`.length);
  // Preserve Next's router state, reattaching only when its streamed update dropped our marker.
  window.history.replaceState({ ...window.history.state, [historyField]: { id, location } }, "");
}

/** Filters share a position; saved plans and settings sections have their own. */
export function mobileScrollKey(href: string) {
  const url = new URL(href, "https://companion.local");
  const detail = url.pathname === "/practice" ? url.searchParams.get("planId") : null;
  const section = url.pathname === "/settings" ? url.searchParams.get("section") : null;
  const query = detail
    ? `?planId=${encodeURIComponent(detail)}`
    : section
      ? `?section=${encodeURIComponent(section)}`
      : "";
  return `${prefix}${roots.has(url.pathname) && !detail ? "" : "detail:"}${url.pathname}${query}`;
}

export function readMobileScroll(key: string) {
  try {
    const value = Number(window.sessionStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function mobilePageScrollLocked() {
  return (
    document.body.hasAttribute("data-scroll-locked") ||
    getComputedStyle(document.body).overflowY === "hidden" ||
    getComputedStyle(document.documentElement).overflowY === "hidden"
  );
}

/** A streamed page may be shorter than its saved position. Wait for real layout. */
export function restoreMobileScroll(top: number, onFinish: (restored: boolean) => void) {
  let stopped = false;
  let frame: number | null = null;
  const finish = (restored: boolean) => {
    if (stopped) return;
    stopped = true;
    if (frame !== null) cancelAnimationFrame(frame);
    clearTimeout(timeout);
    resize.disconnect();
    mutation.disconnect();
    window.removeEventListener("resize", queue);
    for (const event of ["touchstart", "wheel", "keydown"] as const) {
      window.removeEventListener(event, interrupt);
    }
    onFinish(restored);
  };
  const attempt = () => {
    frame = null;
    if (stopped || mobilePageScrollLocked()) return;
    const visibleTitle = Array.from(document.querySelectorAll("main h1")).some(
      (heading) => heading.getClientRects().length > 0,
    );
    if (!visibleTitle || document.documentElement.scrollHeight - window.innerHeight < top - 1)
      return;
    window.scrollTo({ top, behavior: "instant" });
    finish(true);
  };
  function queue() {
    if (!stopped && frame === null) frame = requestAnimationFrame(attempt);
  }
  const interrupt = () => finish(false);
  const resize = new ResizeObserver(queue);
  const mutation = new MutationObserver(queue);
  resize.observe(document.body);
  mutation.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "data-scroll-locked"],
  });
  window.addEventListener("resize", queue);
  for (const event of ["touchstart", "wheel", "keydown"] as const) {
    window.addEventListener(event, interrupt, { passive: true });
  }
  // A timeout releases control without replacing the saved target with a loading position.
  const timeout = setTimeout(() => finish(false), 5_000);
  queue();
  return () => finish(false);
}
