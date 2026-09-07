"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { progressTab, progressTabs, progressTabUrl, type ProgressTab } from "./progress-navigation";
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function ProgressTabs({ panels }: { panels: Record<ProgressTab, ReactNode> }) {
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const query = useSearchParams();
  const router = useRouter();
  return (
    <div className="min-w-0" data-progress-tabs data-ready={ready}>
      <UntitledTabs
        label="Progress sections"
        selectedKey={progressTab(query.get("tab"))}
        onSelectionChange={(key) =>
          router.push(progressTabUrl(window.location.href, progressTab(key)), { scroll: false })
        }
        items={progressTabs.map((tab) => ({
          id: tab.value,
          label: tab.label,
          content: panels[tab.value],
        }))}
      />
    </div>
  );
}
