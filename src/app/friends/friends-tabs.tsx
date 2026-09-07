"use client";
import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { useClientReady } from "@/hooks/use-client-ready";
export type FriendsTab = "friends" | "incoming" | "sent" | "discover" | "blocked";
export function FriendsTabs({
  activeTab,
  counts,
  children,
}: {
  activeTab: FriendsTab;
  counts: Record<FriendsTab, number>;
  children: ReactNode;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="grid min-w-0 gap-3" aria-busy={pending}>
      <p className="text-sm text-muted-foreground">
        Swipe the section strip for requests, discovery and blocked golfers.
      </p>
      <UntitledTabs
        label="Friend sections"
        selectedKey={activeTab}
        disabled={!ready || pending}
        onSelectionChange={(key) => {
          const query = new URLSearchParams(window.location.search);
          query.set("tab", key);
          query.delete("request");
          query.delete("friend");
          query.delete("user");
          start(() => router.push(`/friends?${query}`));
        }}
        items={(
          [
            ["friends", "Friends"],
            ["incoming", "Incoming"],
            ["sent", "Sent"],
            ["discover", "Discover"],
            ["blocked", "Blocked"],
          ] as const
        ).map(([id, label]) => ({
          id,
          label: `${label} (${counts[id]})`,
          content: id === activeTab ? children : null,
        }))}
      />
    </section>
  );
}
