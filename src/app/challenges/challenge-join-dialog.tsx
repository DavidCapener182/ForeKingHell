"use client";
import { ChallengeMembershipDialog } from "./challenge-membership-dialog";
export function ChallengeJoinDialog({
  challengeId,
  challengeTitle,
  disabled = false,
}: {
  challengeId: string;
  challengeTitle: string;
  size?: "sm" | "default";
  disabled?: boolean;
}) {
  return (
    <ChallengeMembershipDialog
      challengeId={challengeId}
      challengeTitle={challengeTitle}
      disabled={disabled}
    />
  );
}
