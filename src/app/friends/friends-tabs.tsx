"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

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
    <ButtonGroup
      aria-label="Friend sections"
      className="max-w-full justify-start overflow-x-auto rounded-lg bg-muted/70 p-1"
      data-friends-section-navigation
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab;

        return (
          <Button
            key={tab.key}
            asChild
            size="sm"
            variant={active ? "secondary" : "ghost"}
            className="whitespace-nowrap"
          >
            <Link href={tab.href} prefetch={false} aria-current={active ? "page" : undefined}>
              {tab.label}
            </Link>
          </Button>
        );
      })}
    </ButtonGroup>
  );
}
