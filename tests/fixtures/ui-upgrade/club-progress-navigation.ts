import { useSyncExternalStore } from "react";
// Fixture equivalent of Next's supported native-history integration.
const push = history.pushState.bind(history);
const replace = history.replaceState.bind(history);
history.pushState = (...args) => {
  push(...args);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
history.replaceState = (...args) => {
  replace(...args);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
export function useSearchParams() {
  return new URLSearchParams(
    useSyncExternalStore(
      (callback) => {
        window.addEventListener("popstate", callback);
        return () => window.removeEventListener("popstate", callback);
      },
      () => location.search,
      () => "",
    ),
  );
}
export function useRouter() {
  return { refresh: () => window.dispatchEvent(new Event("fixture-retry")) };
}
