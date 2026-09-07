"use client";
import { type ReactNode, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { UntitledTabs } from "./tabs";
const subscribe = () => () => {};
/** Page sections keep their mounted forms and preserve every unrelated URL parameter. */
export function UrlTabs({
  tabs,
  defaultTabKey,
  label,
  className,
  queryKey = "tab",
}: {
  tabs: Array<{ id: string; label: string; content: ReactNode }>;
  defaultTabKey: string;
  label: string;
  className?: string;
  queryKey?: string;
}) {
  const query = useSearchParams();
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const requested = query.get(queryKey);
  const selected = tabs.some((tab) => tab.id === requested) ? requested! : defaultTabKey;
  return (
    <div className={className} data-url-tabs data-ready={ready}>
      <UntitledTabs
        label={label}
        disabled={!ready}
        keepMounted
        selectedKey={selected}
        items={tabs}
        onSelectionChange={(key) => {
          const url = new URL(window.location.href);
          url.searchParams.set(queryKey, key);
          window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
        }}
      />
    </div>
  );
}
