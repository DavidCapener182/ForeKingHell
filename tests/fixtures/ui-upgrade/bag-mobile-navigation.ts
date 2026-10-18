import { useSyncExternalStore } from "react";
// Native push/replace do not fire popstate. Notify only this fixture's Next-hook
// substitute, so the real companion history-preservation listener cannot recurse.
const urlEvent = "bag-fixture-url-change";
const push = history.pushState.bind(history);
const replace = history.replaceState.bind(history);
history.pushState = (...args) => {
  push(...args);
  window.dispatchEvent(new Event(urlEvent));
};
history.replaceState = (...args) => {
  replace(...args);
  window.dispatchEvent(new Event(urlEvent));
};
export function useSearchParams() {
  return new URLSearchParams(
    useSyncExternalStore(
      (callback) => {
        window.addEventListener(urlEvent, callback);
        window.addEventListener("popstate", callback);
        return () => {
          window.removeEventListener(urlEvent, callback);
          window.removeEventListener("popstate", callback);
        };
      },
      () => location.search,
      () => "",
    ),
  );
}
export function usePathname() {
  return location.pathname;
}
export function useRouter() {
  return {
    prefetch: async () => {},
    refresh: () => {},
    push: (href: string) => history.pushState(null, "", href),
    replace: (href: string) => history.replaceState(null, "", href),
    back: () => history.back(),
  };
}
