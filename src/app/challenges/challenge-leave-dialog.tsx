"use client";
import { ChallengeMembershipDialog } from "./challenge-membership-dialog";
export function ChallengeLeaveDialog({
  challengeId,
  challengeTitle,
}: {
  challengeId: string;
  challengeTitle: string;
}) {
  return (
    <ChallengeMembershipDialog challengeId={challengeId} challengeTitle={challengeTitle} leave />
  );
}
