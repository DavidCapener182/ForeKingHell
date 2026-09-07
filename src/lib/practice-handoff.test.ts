import { describe, expect, it } from "vitest";
import { practiceSourceSessionId, validPracticeRecordId } from "./practice-handoff";

describe("practice source links", () => {
  const id = "c0c02d1e-605a-47c5-a023-83a1c0d18195";
  it("supports legacy session IDs without confusing session types", () => {
    expect(practiceSourceSessionId({ session: id })).toBe(id);
    expect(practiceSourceSessionId({ session: "speed" })).toBeUndefined();
    expect(practiceSourceSessionId({ session: "range" })).toBeUndefined();
    expect(practiceSourceSessionId({ sourceSessionId: id, session: "speed" })).toBe(id);
  });
  it("preserves an explicit invalid ID for server rejection instead of silently changing scope", () => {
    expect(practiceSourceSessionId({ sourceSessionId: "unavailable", session: id })).toBe(
      "unavailable",
    );
    expect(validPracticeRecordId("unavailable")).toBe(false);
  });
});
