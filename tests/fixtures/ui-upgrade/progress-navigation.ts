import { useSyncExternalStore } from "react";
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
export function useSearchParams() {
  return new URLSearchParams(
    useSyncExternalStore(
      subscribe,
      () => window.location.search,
      () => "",
    ),
  );
}
export function useRouter() {
  return {
    push(href: string) {
      window.history.pushState(null, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  };
}
