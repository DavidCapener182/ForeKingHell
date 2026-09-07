"use client";
import { useClientReady } from "@/hooks/use-client-ready";
import { useState } from "react";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { Button } from "@/components/ui/button";
import { GroupMemberList, type GroupMemberRow } from "@/app/groups/group-member-list";
export function GroupMembersDialog({ members }: { members: GroupMemberRow[] }) {
  const ready = useClientReady();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button disabled={!ready} variant="outline" onClick={() => setOpen(true)}>
        Members ({members.length})
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={setOpen}
        title="Group members"
        description="Search the active roster and inspect each member's role."
      >
        <GroupMemberList members={members} />
      </ResponsiveDetailPanel>
    </>
  );
}
