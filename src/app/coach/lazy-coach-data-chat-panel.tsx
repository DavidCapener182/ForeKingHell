"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CoachDataChatPanelProps = { monthlyRemaining: number; accountId: string };
type DeferredDataChatPanelProps = CoachDataChatPanelProps & { onLoaded: () => void };

const DataChatPanel = dynamic<DeferredDataChatPanelProps>(
  () =>
    import("@/app/data-chat/data-chat-panel").then((module) => {
      const LoadedDataChatPanel = module.DataChatPanel;

      return function LoadedCoachDataChatPanel({
        monthlyRemaining,
        accountId,
        onLoaded,
      }: DeferredDataChatPanelProps) {
        useEffect(() => {
          onLoaded();
        }, [onLoaded]);

        return (
          <LoadedDataChatPanel
            key={accountId}
            accountId={accountId}
            monthlyRemaining={monthlyRemaining}
            questionId="coach-data-chat-question"
            embedded
            suggestions={[
              "Explain the main diagnosis",
              "Show me the source records",
              "Compare my last three sessions",
              "Build a 30-ball practice plan",
            ]}
          />
        );
      };
    }),
  {
    loading: () => null,
  },
);

export function LazyCoachDataChatPanel({ monthlyRemaining, accountId }: CoachDataChatPanelProps) {
  const [loaded, setLoaded] = useState(false);
  const revealContent = useCallback(() => setLoaded(true), []);

  return (
    <ChatLoadBoundary>
      <div
        className={cn("t-skel", loaded && "is-revealed")}
        data-state={loaded ? "loaded" : "loading"}
        aria-busy={!loaded}
        data-lazy-coach-data-chat-boundary
      >
        <CoachDataChatSkeleton hidden={loaded} />
        <div className="t-skel-content" aria-hidden={!loaded} inert={!loaded}>
          <DataChatPanel
            accountId={accountId}
            monthlyRemaining={monthlyRemaining}
            onLoaded={revealContent}
          />
        </div>
      </div>
    </ChatLoadBoundary>
  );
}

class ChatLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="grid gap-3 rounded-lg border p-4">
        <p>Data Chat could not load. Your coaching evidence remains available.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload Data Chat
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function CoachDataChatSkeleton({ hidden }: { hidden: boolean }) {
  return (
    <div
      className="t-skel-skeleton grid gap-3"
      role="status"
      aria-label="Loading Data Chat"
      aria-hidden={hidden}
    >
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-[28rem] w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
