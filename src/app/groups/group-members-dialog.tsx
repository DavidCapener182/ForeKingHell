"use client";

import Link from "next/link";
import { Users } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

type Member = {
  userId: string;
  role: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export function GroupMembersDialog({ members }: { members: Member[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-auto justify-start gap-3 p-3">
          <span className="flex -space-x-2" aria-hidden="true">
            {members.slice(0, 3).map((member) => (
              <span key={member.userId} className="rounded-full ring-2 ring-background">
                <SocialAvatar
                  displayName={member.displayName}
                  username={member.username}
                  avatarUrl={member.avatarUrl}
                  size="sm"
                />
              </span>
            ))}
          </span>
          <span className="text-left">
            <span className="block font-medium">Members</span>
            <span className="block text-xs font-normal text-muted-foreground">
              {members.length} active golfers
            </span>
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Group members</DialogTitle>
          <DialogDescription>
            Everyone currently in this golf crew and their group role.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1">
          {members.length > 0 ? (
            members.map((member) => (
              <Item key={member.userId} variant="outline">
                <ItemMedia>
                  <SocialAvatar
                    displayName={member.displayName}
                    username={member.username}
                    avatarUrl={member.avatarUrl}
                    href={`/profile/${member.username}`}
                    size="sm"
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    <Link href={`/profile/${member.username}`} prefetch={false}>
                      {member.displayName}
                    </Link>
                  </ItemTitle>
                  <ItemDescription>@{member.username}</ItemDescription>
                </ItemContent>
                <Badge variant="secondary">{titleCase(member.role)}</Badge>
              </Item>
            ))
          ) : (
            <AppEmptyState
              icon={<Users />}
              title="No active members yet"
              description="Invite the first golfer to start the roster."
              primaryAction={
                <Button asChild variant="outline">
                  <Link href="/groups">Open groups</Link>
                </Button>
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
