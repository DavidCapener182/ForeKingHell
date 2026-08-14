import Link from "next/link";
import { Check } from "lucide-react";

import { FriendInviteDialog } from "@/app/friends/friend-invite-dialog";
import { FriendsTabs, type FriendsTab } from "@/app/friends/friends-tabs";
import { PeopleDirectory, type PeopleDirectoryRow } from "@/app/friends/people-directory";
import { DesktopWorkbenchLayout } from "@/components/app/desktop-workbench";
import { PageShell } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getFriendsPageData, type SocialProfileSummary } from "@/lib/social";
import { getSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

type FriendsPageProps = {
  searchParams?: Promise<{
    q?: string;
    request?: string;
    friend?: string;
    user?: string;
    tab?: string;
  }>;
};

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const data = await getFriendsPageData(query);
  const activeTab = parseFriendsTab(params?.tab, query);
  const rows = buildPeopleDirectoryRows(
    {
      friends: data.friends,
      incomingRequests: data.incomingRequests,
      outgoingRequests: data.outgoingRequests,
      suggestedProfiles: data.suggestedProfiles,
      searchResults: query ? data.searchResults : [],
      blockedUsers: data.blockedUsers,
    },
    activeTab,
  );
  const profileUrl = `${getSiteOrigin()}/profile/${data.profile.username}`;

  return (
    <PageShell>
      <DesktopWorkbenchLayout scope="friends">
        <div className="hidden items-center justify-end gap-3 sm:flex">
          <Button asChild variant="outline">
            <Link href="/profile" prefetch={false}>
              @{data.profile.username}
            </Link>
          </Button>
        </div>

        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              People directory
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Friends</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Find golfers and manage every connection from one clean directory.
            </p>
          </div>
          <FriendInviteDialog username={data.profile.username} profileUrl={profileUrl} />
        </header>

        {params?.request || params?.friend || params?.user ? (
          <Alert>
            <Check className="size-4" />
            <AlertTitle>Directory updated</AlertTitle>
            <AlertDescription>Your people and connection states are up to date.</AlertDescription>
          </Alert>
        ) : null}

        <FriendsTabs activeTab={activeTab} />
        <PeopleDirectory rows={rows} query={query} activeTab={activeTab} />
      </DesktopWorkbenchLayout>
    </PageShell>
  );
}

function buildPeopleDirectoryRows(
  input: {
    friends: SocialProfileSummary[];
    incomingRequests: Array<{ request: { id: string }; profile: SocialProfileSummary }>;
    outgoingRequests: Array<{ request: { id: string }; profile: SocialProfileSummary }>;
    suggestedProfiles: SocialProfileSummary[];
    searchResults: SocialProfileSummary[];
    blockedUsers: SocialProfileSummary[];
  },
  activeTab: FriendsTab,
) {
  if (activeTab === "friends") {
    return input.friends.map((profile) => directoryRow(profile, "friend"));
  }
  if (activeTab === "incoming") {
    return input.incomingRequests.map(({ request, profile }) =>
      directoryRow(profile, "incoming", request.id),
    );
  }
  if (activeTab === "sent") {
    return input.outgoingRequests.map(({ request, profile }) =>
      directoryRow(profile, "outgoing", request.id),
    );
  }
  if (activeTab === "blocked") {
    return input.blockedUsers.map((profile) => directoryRow(profile, "blocked"));
  }

  const rows: PeopleDirectoryRow[] = [];
  const seenUserIds = new Set<string>();

  input.searchResults.forEach((profile) => {
    seenUserIds.add(profile.userId);
    rows.push({ ...directoryRow(profile, "search"), section: "results" });
  });
  input.suggestedProfiles.forEach((profile) => {
    if (seenUserIds.has(profile.userId)) return;
    seenUserIds.add(profile.userId);
    rows.push({ ...directoryRow(profile, "suggested"), section: "recommended" });
  });

  return rows;
}

function directoryRow(
  profile: SocialProfileSummary,
  status: PeopleDirectoryRow["status"],
  requestId?: string,
): PeopleDirectoryRow {
  return {
    id: `${status}:${requestId ?? profile.userId}`,
    profile,
    status,
    requestId,
  };
}

function parseFriendsTab(value: string | undefined, query: string): FriendsTab {
  if (query) return "discover";
  return value === "incoming" || value === "sent" || value === "discover" || value === "blocked"
    ? value
    : "friends";
}
