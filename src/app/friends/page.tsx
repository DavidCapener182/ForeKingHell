import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, Ban, Check, Copy, QrCode, Search, Trophy, UserMinus, UserPlus, Users, X } from "lucide-react";

import {
  acceptFriendRequestAction,
  blockUserAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction,
  sendFriendRequestAction,
  unblockUserAction,
} from "@/app/friends/actions";
import {
  DataPanel,
  PageShell,
  SectionHeader,
  StatusPill,
} from "@/components/premium";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getFriendsPageData, type SocialProfileSummary } from "@/lib/social";

export const dynamic = "force-dynamic";

type FriendsPageProps = {
  searchParams?: Promise<{
    q?: string;
    request?: string;
    friend?: string;
    user?: string;
  }>;
};

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  const query = params?.q?.trim() ?? "";
  const data = await getFriendsPageData(query);
  const profileUrl = `${getRequestOrigin(requestHeaders)}/profile/${data.profile.username}`;

  return (
    <PageShell size="6xl">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/dashboard" prefetch={false}>
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/profile" prefetch={false}>
            @{data.profile.username}
          </Link>
        </Button>
      </div>

      <header className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="h-24 bg-[linear-gradient(135deg,#111827,#047857_52%,#38bdf8)]" />
        <div className="grid gap-4 p-5 pt-0">
          <div className="-mt-9 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:gap-4">
              <SocialAvatar
                displayName={data.profile.displayName}
                username={data.profile.username}
                avatarUrl={data.profile.avatarUrl}
                href="/profile"
                size="lg"
              />
              <div className="pb-1">
                <StatusPill tone="green">Social graph</StatusPill>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal">Friends</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Find golfers by username, approve requests, and keep friendships separate from coach/viewer/editor account access.
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/feed" prefetch={false}>Open feed</Link>
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <SocialStat label="Friends" value={data.friends.length} detail="Connected golfers" />
            <SocialStat label="Incoming" value={data.incomingRequests.length} detail="Pending approvals" />
            <SocialStat label="Outgoing" value={data.outgoingRequests.length} detail="Sent requests" />
            <SocialStat label="Search" value={query ? data.searchResults.length : "--"} detail="Username matches" />
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <DataPanel>
          <SectionHeader
            title="Invite"
            description="Use a profile link or QR code when sharing inside Rapsodo groups."
            action={<QrCode className="size-5 text-emerald-600" />}
          />
          <CardContent className="grid gap-3">
            <div className="rounded-xl border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/friends/qr/${data.profile.username}`}
                alt={`QR invite for @${data.profile.username}`}
                className="mx-auto aspect-square w-full max-w-40"
              />
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <p className="font-medium">Invite link</p>
              <code className="mt-1 block break-all text-muted-foreground">{profileUrl}</code>
            </div>
            <Button asChild variant="outline">
              <Link href={profileUrl} prefetch={false}>
                <Copy className="size-4" />
                Open invite page
              </Link>
            </Button>
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader
            title="Suggested friends"
            description="Public profiles outside your current graph."
            action={<Users className="size-5 text-sky-600" />}
          />
          <CardContent>
            <ProfileList empty="No public suggestions yet." profiles={data.suggestedProfiles} mode="search" />
          </CardContent>
        </DataPanel>
      </section>

      {params?.request || params?.friend || params?.user ? (
        <Alert>
          <Check className="size-4" />
          <AlertTitle>Social graph updated</AlertTitle>
          <AlertDescription>Your friend list and visibility scopes have been refreshed.</AlertDescription>
        </Alert>
      ) : null}

      <DataPanel>
        <SectionHeader
          title="Find friends"
          description="Private profiles do not appear in search. Search requires public profile opt-in."
          action={<Search className="size-5 text-sky-600" />}
        />
        <CardContent className="grid gap-4">
          <form className="grid gap-2 sm:grid-cols-[1fr_auto]" action="/friends">
            <Input name="q" defaultValue={query} placeholder="Search by username" className="h-10 rounded-xl bg-white" />
            <Button type="submit" className="rounded-xl bg-[#111827] text-white">
              <Search className="size-4" />
              Search
            </Button>
          </form>
          {query ? (
            <ProfileList
              empty="No public profiles matched that username."
              profiles={data.searchResults}
              mode="search"
            />
          ) : null}
        </CardContent>
      </DataPanel>

      <section className="grid gap-4 lg:grid-cols-3">
        <DataPanel>
          <SectionHeader title="Incoming requests" description="Approve only people you want in friend-scoped feed and leaderboard views." />
          <CardContent>
            <RequestList rows={data.incomingRequests} direction="incoming" />
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader title="Friends" description="Friends do not get account access unless you separately invite them from settings." />
          <CardContent>
            <ProfileList empty="No friends yet." profiles={data.friends} mode="friends" />
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader title="Outgoing requests" description="Cancel requests that have not been accepted yet." />
          <CardContent>
            <RequestList rows={data.outgoingRequests} direction="outgoing" />
          </CardContent>
        </DataPanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DataPanel>
          <SectionHeader title="Active this week" description="Shortcuts for friend-scoped competition." action={<Trophy className="size-5 text-amber-600" />} />
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline">
              <Link href="/leaderboard?tab=friends" prefetch={false}>Friends leaderboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/challenges" prefetch={false}>Start challenge</Link>
            </Button>
          </CardContent>
        </DataPanel>

        <DataPanel>
          <SectionHeader title="Blocked users" description="Blocked users cannot see friend-scoped profile or feed activity." action={<Ban className="size-5 text-red-600" />} />
          <CardContent>
            <BlockedList profiles={data.blockedUsers} />
          </CardContent>
        </DataPanel>
      </section>
    </PageShell>
  );
}

function ProfileList({
  profiles,
  empty,
  mode,
}: {
  profiles: SocialProfileSummary[];
  empty: string;
  mode: "search" | "friends";
}) {
  if (profiles.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="grid gap-2">
      {profiles.map((profile) => (
        <div
          key={profile.userId}
          className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3 shadow-sm"
          data-friend-user-id={profile.userId}
        >
          <div className="flex min-w-0 items-center gap-3">
            <SocialAvatar
              displayName={profile.displayName}
              username={profile.username}
              avatarUrl={profile.avatarUrl}
              href={`/profile/${profile.username}`}
            />
            <div className="min-w-0">
              <Link href={`/profile/${profile.username}`} prefetch={false} className="truncate text-sm font-semibold hover:underline">
                {profile.displayName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mode === "friends" ? (
              <>
                <form action={removeFriendAction}>
                  <input type="hidden" name="friendUserId" value={profile.userId} />
                  <Button type="submit" variant="ghost" size="sm">
                    <UserMinus className="size-4" />
                    Remove
                  </Button>
                </form>
                <form action={blockUserAction} data-friend-block-form>
                  <input type="hidden" name="blockedUserId" value={profile.userId} />
                  <Button type="submit" variant="ghost" size="sm">
                    <Ban className="size-4" />
                    Block
                  </Button>
                </form>
              </>
            ) : (
              <SearchResultAction profile={profile} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchResultAction({ profile }: { profile: SocialProfileSummary }) {
  if (profile.relationship === "friend") {
    return <Badge variant="secondary">Friend</Badge>;
  }

  if (profile.relationship === "outgoing") {
    return <Badge variant="outline">Pending</Badge>;
  }

  if (profile.relationship === "incoming") {
    return <Badge variant="outline">Requested you</Badge>;
  }

  return (
    <form action={sendFriendRequestAction}>
      <input type="hidden" name="recipientUserId" value={profile.userId} />
      <Button type="submit" size="sm">
        <UserPlus className="size-4" />
        Add
      </Button>
    </form>
  );
}

function BlockedList({ profiles }: { profiles: SocialProfileSummary[] }) {
  if (profiles.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No blocked users.</p>;
  }

  return (
    <div className="grid gap-2">
      {profiles.map((profile) => (
        <div key={profile.userId} className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
          </div>
          <form action={unblockUserAction}>
            <input type="hidden" name="blockedUserId" value={profile.userId} />
            <Button type="submit" variant="outline" size="sm">Unblock</Button>
          </form>
        </div>
      ))}
    </div>
  );
}

function RequestList({
  rows,
  direction,
}: {
  rows: Array<{ request: { id: string }; profile: SocialProfileSummary }>;
  direction: "incoming" | "outgoing";
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No pending requests.</p>;
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.request.id} className="grid gap-3 rounded-xl border bg-white px-3 py-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <SocialAvatar
              displayName={row.profile.displayName}
              username={row.profile.username}
              avatarUrl={row.profile.avatarUrl}
              href={`/profile/${row.profile.username}`}
            />
            <div className="min-w-0">
              <Link href={`/profile/${row.profile.username}`} prefetch={false} className="truncate text-sm font-semibold hover:underline">
                {row.profile.displayName}
              </Link>
              <p className="truncate text-xs text-muted-foreground">@{row.profile.username}</p>
            </div>
          </div>
          {direction === "incoming" ? (
            <div className="flex gap-2">
              <form action={acceptFriendRequestAction}>
                <input type="hidden" name="requestId" value={row.request.id} />
                <Button type="submit" size="sm">
                  <Check className="size-4" />
                  Accept
                </Button>
              </form>
              <form action={declineFriendRequestAction}>
                <input type="hidden" name="requestId" value={row.request.id} />
                <Button type="submit" variant="outline" size="sm">
                  <X className="size-4" />
                  Decline
                </Button>
              </form>
            </div>
          ) : (
            <form action={cancelFriendRequestAction}>
              <input type="hidden" name="requestId" value={row.request.id} />
              <Button type="submit" variant="outline" size="sm">
                <X className="size-4" />
                Cancel
              </Button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

function SocialStat({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 px-3 py-2">
      <p className="text-xl font-semibold tracking-normal">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function getRequestOrigin(requestHeaders: Headers) {
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
