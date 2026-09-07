import { useSyncExternalStore } from "react";
export function useSearchParams() {
  return new URLSearchParams(
    useSyncExternalStore(
      (listener) => {
        window.addEventListener("popstate", listener);
        return () => window.removeEventListener("popstate", listener);
      },
      () => location.search,
      () => "",
    ),
  );
}
