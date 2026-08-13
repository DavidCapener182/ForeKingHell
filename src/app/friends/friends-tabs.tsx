"use client";

import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type FriendsTab = "friends" | "incoming" | "sent" | "discover" | "blocked";

const tabs: Array<{ key: FriendsTab; label: string; href: string }> = [
  { key: "friends", label: "Friends", href: "/friends?tab=friends" },
  { key: "incoming", label: "Incoming", href: "/friends?tab=incoming" },
  { key: "sent", label: "Sent", href: "/friends?tab=sent" },
  { key: "discover", label: "Discover", href: "/friends?tab=discover" },
  { key: "blocked", label: "Blocked", href: "/friends?tab=blocked" },
];

export function FriendsTabs({ activeTab }: { activeTab: FriendsTab }) {
  return (
    <Tabs value={activeTab} aria-label="Friend sections">
      <TabsList className="h-auto w-full justify-start overflow-x-auto bg-muted/70 p-1">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} asChild>
            <Link href={tab.href} prefetch={false}>
              {tab.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
