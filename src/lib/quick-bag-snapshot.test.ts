import { describe, expect, it } from "vitest";
import { mobileQuickBagClub } from "./mobile-quick-bag-evidence";
import { createQuickBagSnapshot, readQuickBagSnapshot } from "./quick-bag-snapshot";
const club = mobileQuickBagClub({ id: "club", type: "7i", brand: null, model: null }, []);
const saved = () => createQuickBagSnapshot("alice", [club], "2026-09-05T09:00:00.000Z");
describe("Quick Bag offline snapshot", () => {
  it("retains the saved time and same-account measurements without renewing their age", () => {
    expect(readQuickBagSnapshot(JSON.stringify(saved()), "alice")).toEqual({
      ...saved(),
      legacy: false,
    });
    expect(readQuickBagSnapshot(JSON.stringify(saved()), "bob")).toBeNull();
  });
  it("recovers legacy yardages without claiming that their dates verify the same sample", () => {
    const old = {
      version: 3,
      storedAt: saved().storedAt,
      clubs: [{ ...club, latestEvidenceDate: "2026-09-01" }],
    };
    expect(readQuickBagSnapshot(JSON.stringify(old), "alice")).toMatchObject({
      legacy: true,
      clubs: [{ latestEvidenceDate: null }],
    });
  });
  it("rejects malformed, future-version, duplicate and non-finite data without crashing offline recovery", () => {
    for (const raw of [
      "{",
      "null",
      JSON.stringify({ ...saved(), version: 5 }),
      JSON.stringify({ ...saved(), storedAt: "bad" }),
      JSON.stringify({ ...saved(), clubs: [club, club] }),
      JSON.stringify({ ...saved(), clubs: [{ ...club, trustedCarryYd: "154" }] }),
      JSON.stringify({ ...saved(), clubs: [{ ...club, sampleSize: -1 }] }),
    ])
      expect(readQuickBagSnapshot(raw, "alice")).toBeNull();
  });
});
