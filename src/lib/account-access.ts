import "server-only";

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { accountMemberships } from "@/db/schema";
import { getDb } from "@/db/client";
import { requireCurrentUserId } from "@/lib/current-user";

export const readableRoles = ["coach", "viewer", "editor"] as const;
export const editableRoles = ["editor"] as const;

export type AccountAccessRole = (typeof readableRoles)[number];

export type AccountMembershipAccess = {
  ownerUserId: string;
  memberUserId: string;
  role: string;
};

export function canReadAccount(currentUserId: string, targetUserId: string, memberships: AccountMembershipAccess[]) {
  if (currentUserId === targetUserId) {
    return true;
  }

  return memberships.some(
    (membership) =>
      membership.ownerUserId === targetUserId &&
      membership.memberUserId === currentUserId &&
      readableRoles.includes(membership.role as AccountAccessRole),
  );
}

export function canEditAccount(currentUserId: string, targetUserId: string, memberships: AccountMembershipAccess[]) {
  if (currentUserId === targetUserId) {
    return true;
  }

  return memberships.some(
    (membership) =>
      membership.ownerUserId === targetUserId &&
      membership.memberUserId === currentUserId &&
      editableRoles.includes(membership.role as (typeof editableRoles)[number]),
  );
}

export async function requireReadableAccountUserId(targetUserId: string) {
  const currentUserId = await requireCurrentUserId();

  if (currentUserId === targetUserId) {
    return { currentUserId, targetUserId, role: "owner" as const };
  }

  const [membership] = await getDb()
    .select({
      ownerUserId: accountMemberships.ownerUserId,
      memberUserId: accountMemberships.memberUserId,
      role: accountMemberships.role,
    })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.ownerUserId, targetUserId), eq(accountMemberships.memberUserId, currentUserId)))
    .limit(1);

  if (!membership || !canReadAccount(currentUserId, targetUserId, [membership])) {
    notFound();
  }

  return { currentUserId, targetUserId, role: membership.role };
}
