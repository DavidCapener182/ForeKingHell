import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

type RoundPrecondition = {
  userId: string;
  sessionId: string;
  expectedVersion: string;
};

const precondition = new AsyncLocalStorage<RoundPrecondition>();

/** Browser versions use millisecond timestamps, so each save must advance at least one millisecond. */
export function nextRoundVersionTime(previous: Date) {
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}

export class OfflineRoundConflict extends Error {
  constructor(public readonly currentVersion: string | null) {
    super(
      "This round changed after the offline edit was queued. Review the latest round before applying it again.",
    );
    this.name = "OfflineRoundConflict";
  }
}

/** Only the offline endpoint installs this guard; ordinary online hole edits retain their behavior. */
export function withOfflineRoundPrecondition<T>(
  expected: RoundPrecondition,
  operation: () => Promise<T>,
) {
  return precondition.run(expected, operation);
}

/** Call after selecting the owned round FOR UPDATE and before writing in the same transaction. */
export function assertOfflineRoundPrecondition(round: {
  id: string;
  userId: string;
  updatedAt: Date;
}) {
  const expected = precondition.getStore();
  if (!expected) return;
  const currentVersion = round.updatedAt.toISOString();
  if (
    round.id !== expected.sessionId ||
    round.userId !== expected.userId ||
    currentVersion !== expected.expectedVersion
  ) {
    throw new OfflineRoundConflict(round.userId === expected.userId ? currentVersion : null);
  }
}
