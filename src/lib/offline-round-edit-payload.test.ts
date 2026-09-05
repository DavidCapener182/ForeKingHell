import { describe, expect, it } from "vitest";

import {
  offlineRoundEditPayloadToFormData,
  parseOfflineRoundEditPayload,
} from "@/lib/offline-round-edit-payload";

describe("offline round edit payloads", () => {
  it("accepts known round edit kinds and string fields", () => {
    const payload = parseOfflineRoundEditPayload({
      editKind: "round-hole",
      fields: [
        ["sessionId", "session-1"],
        ["holeNumber", "4"],
        ["score", "5"],
      ],
    });

    expect(payload?.editKind).toBe("round-hole");
    expect(payload?.fields).toContainEqual(["score", "5"]);
  });

  it("converts payload fields back into FormData", () => {
    const payload = parseOfflineRoundEditPayload({
      editKind: "round-context",
      fields: [
        ["sessionId", "session-1"],
        ["roundStatus", "in_progress"],
      ],
    });

    expect(payload).not.toBeNull();
    const formData = offlineRoundEditPayloadToFormData(payload!);
    expect(formData.get("roundStatus")).toBe("in_progress");
  });

  it("round completion retains its version precondition and does not overwrite context", () => {
    const payload = parseOfflineRoundEditPayload({
      editKind: "round-complete",
      fields: [
        ["sessionId", "session-1"],
        ["expectedUpdatedAt", "2026-09-05T00:00:00.000Z"],
      ],
    });
    expect(payload?.editKind).toBe("round-complete");
    const data = offlineRoundEditPayloadToFormData(payload!);
    expect(data.get("expectedUpdatedAt")).toBe("2026-09-05T00:00:00.000Z");
    expect(data.has("notes")).toBe(false);
  });

  it("rejects unknown edit kinds", () => {
    expect(
      parseOfflineRoundEditPayload({ editKind: "delete-round", fields: [["id", "1"]] }),
    ).toBeNull();
  });
});
