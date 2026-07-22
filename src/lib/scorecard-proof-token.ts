import "server-only";

import { scorecardProofConsumptions } from "@/db/schema";
import { getDb } from "@/db/client";
import {
  verifyScorecardProofToken,
  type ScorecardProofScope,
} from "@/lib/scorecard-proof-token-core";

export {
  createScorecardProofToken,
  verifyScorecardProofToken,
  type ScorecardProofPayload,
  type ScorecardProofScope,
} from "@/lib/scorecard-proof-token-core";

export async function consumeScorecardProofToken(
  token: string | null | undefined,
  userId: string,
  scope: ScorecardProofScope,
) {
  const payload = verifyScorecardProofToken(token, userId, scope);

  if (!payload) {
    return null;
  }

  const [consumption] = await getDb()
    .insert(scorecardProofConsumptions)
    .values({
      proofId: payload.proofId,
      userId,
      scopeType: payload.scopeType,
      scopeId: payload.scopeId,
      roundNumber: payload.roundNumber,
      imageHash: payload.imageHash,
    })
    .onConflictDoNothing()
    .returning({ proofId: scorecardProofConsumptions.proofId });

  return consumption ? payload : null;
}
