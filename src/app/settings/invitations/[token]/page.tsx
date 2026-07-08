import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Check, ShieldCheck } from "lucide-react";

import { acceptInvitationAction } from "@/app/settings/actions";
import { DataPanel, PageHeader, PageShell, SectionHeader, StatusPill } from "@/components/premium";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { accountInvitations, users } from "@/db/schema";
import { BRAND_NAME } from "@/lib/brand";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { hashInvitationToken } from "@/lib/collaboration";

export const dynamic = "force-dynamic";

type InvitationPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;
  const [invitation, currentUser] = await Promise.all([getInvitation(token), getCurrentUser()]);

  if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= new Date()) {
    notFound();
  }

  const emailMatches = currentUser?.email?.toLowerCase() === invitation.invitedEmail.toLowerCase();

  return (
    <PageShell>
      <PageHeader
        eyebrow={<StatusPill tone="green">Invitation</StatusPill>}
        title={`Accept ${BRAND_NAME} access`}
        description={`${invitation.ownerName ?? invitation.ownerEmail ?? `An ${BRAND_NAME} user`} invited ${invitation.invitedEmail} as ${invitation.role}.`}
      />

      {!currentUser ? (
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Sign in required</AlertTitle>
          <AlertDescription>
            Sign in with {invitation.invitedEmail} before accepting this invite.
          </AlertDescription>
        </Alert>
      ) : null}

      {currentUser && !emailMatches ? (
        <Alert variant="destructive">
          <ShieldCheck className="size-4" />
          <AlertTitle>Wrong signed-in account</AlertTitle>
          <AlertDescription>
            This invite is for {invitation.invitedEmail}; you are signed in as{" "}
            {currentUser.email ?? currentUser.id}.
          </AlertDescription>
        </Alert>
      ) : null}

      <DataPanel>
        <SectionHeader
          title="Shared account access"
          description="Accepting creates a membership record. Owner data remains separated from your own account data."
        />
        <CardContent>
          {currentUser ? (
            <form action={acceptInvitationAction} className="grid gap-4">
              <input type="hidden" name="token" value={token} />
              <Button
                type="submit"
                disabled={!emailMatches}
                className="w-full rounded-xl bg-[#111827] text-white sm:w-fit"
              >
                <Check className="size-4" />
                Accept invite
              </Button>
            </form>
          ) : (
            <Button asChild className="rounded-xl bg-[#111827] text-white">
              <Link href={`/login?next=/settings/invitations/${encodeURIComponent(token)}`}>
                Sign in to accept
              </Link>
            </Button>
          )}
        </CardContent>
      </DataPanel>
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
