"use client";
import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { useClientReady } from "@/hooks/use-client-ready";
export type GroupDirectoryTab = "mine" | "discover" | "invites";
export function GroupDirectoryTabs({
  activeTab,
  counts,
  children,
}: {
  activeTab: GroupDirectoryTab;
  counts: Record<GroupDirectoryTab, number>;
  children: ReactNode;
}) {
  const ready = useClientReady();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="grid min-w-0 gap-3" aria-busy={pending}>
      <p className="text-sm text-muted-foreground">
        Swipe the section strip to find your groups, discover crews and review invitations.
      </p>
      <UntitledTabs
        label="Group directory sections"
        selectedKey={activeTab}
        disabled={!ready || pending}
        onSelectionChange={(key) => {
          const query = new URLSearchParams(window.location.search);
          query.set("tab", key);
          for (const key of ["created", "joined", "left", "deleted", "declined"]) query.delete(key);
          start(() => router.push(`/groups?${query}`));
        }}
        items={(
          [
            ["mine", "My groups"],
            ["discover", "Discover"],
            ["invites", "Invitations"],
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
