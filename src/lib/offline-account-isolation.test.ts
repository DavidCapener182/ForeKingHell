import { describe, expect, it } from "vitest";

import { offlineActionsForAccount, type OfflineActionRecord } from "@/lib/offline-queue";

const actions: OfflineActionRecord[] = [
  {
    id: "a",
    kind: "import-csv",
    ownerUserId: "user-a",
    payload: { inputs: [] },
    createdAt: "2026-07-10T09:00:00.000Z",
    retryCount: 0,
  },
  {
    id: "b",
    kind: "round-edit",
    ownerUserId: "user-b",
    payload: { fields: [] },
    createdAt: "2026-07-10T09:00:00.000Z",
    retryCount: 0,
  },
];

describe("offline account isolation", () => {
  it("only returns queued actions owned by the active account", () => {
    expect(offlineActionsForAccount(actions, "user-b").map((action) => action.id)).toEqual(["b"]);
    expect(offlineActionsForAccount(actions, "unknown")).toEqual([]);
  });
});
