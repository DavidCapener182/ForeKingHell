"use client";
import { useClientReady } from "@/hooks/use-client-ready";
import { useState } from "react";
import Link from "next/link";
import responsive from "@/app/course-records/course-record-board.module.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SocialAvatar } from "@/components/social/social-avatar";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
export type GroupMemberRow = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  points?: number;
  summary?: string;
};
export function GroupMemberList({ members }: { members: GroupMemberRow[] }) {
  const ready = useClientReady();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GroupMemberRow | null>(null);
  const rows = members.filter((m) =>
    `${m.displayName} ${m.username} ${m.role}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="grid min-w-0 gap-4">
      <Label>
        Search members
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, username or role"
        />
      </Label>
      <p className="text-sm text-muted-foreground">
        {rows.length} of {members.length} active members
      </p>
      <div className={responsive.desktop}>
        <div
          className="overflow-x-auto rounded-xl border"
          role="region"
          aria-label="Group member table"
          tabIndex={0}
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Active group members and their weekly performance</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-3">
                  Golfer
                </th>
                <th scope="col" className="p-3">
                  Role
                </th>
                <th scope="col" className="p-3 text-right">
                  Weekly points (pts)
                </th>
                <th scope="col" className="p-3">
                  Summary
                </th>
                <th scope="col" className="p-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.userId} className="border-b last:border-0">
                  <th scope="row" className="p-3">
                    <Link href={`/profile/${m.username}`} className="break-words hover:underline">
                      {m.displayName}
                    </Link>
                    <p className="break-all font-normal text-muted-foreground">@{m.username}</p>
                  </th>
                  <td className="p-3">{m.role}</td>
                  <td className="p-3 text-right tabular-nums">{m.points ?? "—"}</td>
                  <td className="p-3">{m.summary ?? "No round this week"}</td>
                  <td className="p-3">
                    <Button
                      disabled={!ready}
                      variant="outline"
                      onClick={() => setSelected(m)}
                      aria-label={`Details for ${m.displayName}`}
                    >
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={responsive.mobile}>
        <div className="grid gap-2">
          {rows.map((m) => (
            <article
              key={m.userId}
              className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border bg-card p-4"
            >
              <SocialAvatar
                displayName={m.displayName}
                avatarUrl={m.avatarUrl}
                username={m.username}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/profile/${m.username}`}
                  className="break-words font-semibold hover:underline"
                >
                  {m.displayName}
                </Link>
                <p className="break-all text-sm text-muted-foreground">@{m.username}</p>
                <Badge variant="secondary">{m.role}</Badge>
              </div>
              <Button
                disabled={!ready}
                variant="outline"
                className="min-h-11"
                onClick={() => setSelected(m)}
                aria-label={`Details for ${m.displayName}`}
              >
                Details
              </Button>
            </article>
          ))}
        </div>
      </div>
      {!rows.length ? (
        <p role="status">{query ? "No members match this search." : "No active members."}</p>
      ) : null}
      <ResponsiveDetailPanel
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.displayName ?? "Member details"}
        description="The selected golfer's role and available group performance."
      >
        {selected ? (
          <div className="grid gap-4">
            <dl className="grid gap-3">
              <div>
                <dt>Username</dt>
                <dd className="break-all">@{selected.username}</dd>
              </div>
              <div>
                <dt>Group role</dt>
                <dd>{selected.role}</dd>
              </div>
              <div>
                <dt>This week</dt>
                <dd>
                  {selected.points === undefined ? "No round this week" : `${selected.points} pts`}
                </dd>
              </div>
              {selected.summary ? (
                <div>
                  <dt>Performance summary</dt>
                  <dd>{selected.summary}</dd>
                </div>
              ) : null}
            </dl>
            <Button asChild>
              <Link href={`/profile/${selected.username}`}>Open profile</Link>
            </Button>
          </div>
        ) : null}
      </ResponsiveDetailPanel>
    </div>
  );
}
