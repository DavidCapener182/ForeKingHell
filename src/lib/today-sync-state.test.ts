import { describe, expect, it } from "vitest";

import type { OfflineActionRecord } from "@/lib/offline-queue";
import { getTodaySyncOverride } from "@/lib/today-sync-state";

describe("Today queued-import priority", () => {
  it("ignores unrelated queued round edits", () => {
    expect(getTodaySyncOverride([action("round-edit")], false)).toBeNull();
  });

  it("promotes an offline import ahead of the server recommendation", () => {
    expect(getTodaySyncOverride([action("import-csv")], false)).toMatchObject({
      eyebrow: "Upload queued on this phone",
      status: "Waiting for connection",
      action: "View queued upload",
    });
  });

  it("uses syncing language online and never claims analysis is complete", () => {
    const state = getTodaySyncOverride([action("import-csv")], true);

    expect(state).toMatchObject({ status: "Syncing", action: "View import status" });
    expect(state?.reason).toContain("only after sync completes");
  });

  it("puts dead-letter imports ahead of retrying imports", () => {
    expect(
      getTodaySyncOverride([action("import-csv"), action("import-csv", "dead_letter")], true),
    ).toMatchObject({
      status: "Needs attention",
      href: "/settings#offline-storage",
    });
  });
});

function action(
  kind: OfflineActionRecord["kind"],
  status: OfflineActionRecord["status"] = "pending",
): OfflineActionRecord {
  return {
    id: `${kind}-${status}`,
    kind,
    ownerUserId: "user-1",
    payload: {},
    createdAt: "2026-08-12T00:00:00.000Z",
    retryCount: status === "dead_letter" ? 5 : 0,
    status,
  };
}
