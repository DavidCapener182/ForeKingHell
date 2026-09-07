"use client";
import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UntitledTabs } from "@/components/untitled-ui/tabs";
import { useClientReady } from "@/hooks/use-client-ready";
export function CourseRecordScopes({
  active,
  counts,
  children,
}: {
  active: string;
  counts: { allTimeCount: number; monthCount: number; friendsCount: number; holesCount: number };
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const ready = useClientReady();
  const items = [
    { id: "all_time", label: `All-time (${counts.allTimeCount})` },
    { id: "month", label: `Monthly (${counts.monthCount})` },
    { id: "friends", label: `Friends (${counts.friendsCount})` },
    { id: "holes", label: `Holes (${counts.holesCount})` },
  ];
  return (
    <section className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        Current scope: {items.find((item) => item.id === active)?.label}. Swipe the scope strip for
        more.
      </p>
      <UntitledTabs
        label="Course record scopes"
        selectedKey={active}
        disabled={pending || !ready}
        onSelectionChange={(key) =>
          startTransition(() => {
            const url = new URL(window.location.href);
            url.searchParams.set("tab", key);
            router.push(url.pathname + url.search, { scroll: false });
          })
        }
        items={items.map((item) => ({ ...item, content: item.id === active ? children : null }))}
      />
      {pending ? <p role="status">Loading selected record scope…</p> : null}
    </section>
  );
}
