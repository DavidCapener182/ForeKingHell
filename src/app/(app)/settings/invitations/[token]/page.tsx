import Link from "next/link";
import { eq } from "drizzle-orm";
import { InvitationAccept } from "@/app/settings/invitation-accept";
import { PageHeader, PageShell } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { accountInvitations, users } from "@/db/schema";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { hashInvitationToken } from "@/lib/collaboration";
export const dynamic = "force-dynamic";
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, currentUser] = await Promise.all([getInvitation(token), getCurrentUser()]);
  const unavailable = !invitation
    ? "Invitation not found"
    : invitation.status !== "pending"
      ? invitation.status === "accepted"
        ? "Invitation already accepted"
        : "Invitation cancelled or unavailable"
      : invitation.expiresAt <= new Date()
        ? "Invitation expired"
        : null;
  if (unavailable)
    return (
      <PageShell>
        <div className="grid gap-4 pb-28">
          <PageHeader
            title={unavailable}
            description="This link cannot create a new membership. Request a new invitation from the account owner if you still need access."
          />
          <Button asChild variant="outline">
            <Link href="/settings?section=sharing" prefetch={false}>
              Review current account access
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  const invite = invitation!;
  const emailMatches = currentUser?.email?.toLowerCase() === invite.invitedEmail.toLowerCase();
  const owner = invite.ownerName ?? invite.ownerEmail ?? "Account owner";
  const signIn = `/login?next=${encodeURIComponent("/settings/invitations/" + token)}`;
  return (
    <PageShell>
      <div className="grid min-w-0 gap-5 pb-28">
        <PageHeader
          title="Account invitation"
          description={`${owner} has invited you to their account.`}
          actions={
            <Button asChild variant="outline">
              <Link href="/settings?section=sharing" prefetch={false}>
                Back to account access
              </Link>
            </Button>
          }
        />
        <dl className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          {Object.entries({
            Inviter: owner,
            Recipient: invite.invitedEmail,
            Role: invite.role,
            Expires: invite.expiresAt.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          }).map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="rounded-xl border p-4 text-sm">
          {invite.role === "editor"
            ? "Editor access can read and edit supported shared-account data."
            : "Coach and viewer access can read supported shared-account data; these roles cannot edit it."}{" "}
          Acceptance creates only this account membership. It does not merge your data or change
          your public profile.
        </p>
        {!currentUser ? (
          <div className="grid gap-3">
            <p role="status">Sign in with {invite.invitedEmail} to accept.</p>
            <Button asChild>
              <Link href={signIn} prefetch={false}>
                Sign in to accept
              </Link>
            </Button>
          </div>
        ) : !emailMatches ? (
          <div className="grid gap-3">
            <p role="alert" className="break-words">
              Wrong signed-in account. This invitation is for {invite.invitedEmail}; you are signed
              in as {currentUser.email ?? currentUser.id}.
            </p>
            <Button asChild variant="outline">
              <Link href={signIn} prefetch={false}>
                Use the invited account
              </Link>
            </Button>
          </div>
        ) : (
          <InvitationAccept
            token={token}
            owner={owner}
            recipient={invite.invitedEmail}
            role={invite.role}
          />
        )}
      </div>
    </PageShell>
  );
}
async function getInvitation(token: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: accountInvitations.id,
      invitedEmail: accountInvitations.invitedEmail,
      ownerEmail: users.email,
      ownerName: users.name,
      role: accountInvitations.role,
      status: accountInvitations.status,
      expiresAt: accountInvitations.expiresAt,
    })
    .from(accountInvitations)
    .leftJoin(users, eq(users.id, accountInvitations.ownerUserId))
    .where(eq(accountInvitations.tokenHash, hashInvitationToken(token)))
    .limit(1);

  return row ?? null;
}
