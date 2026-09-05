import { describe, expect, it } from "vitest";
import type { SavedRound } from "@/app/rounds/mobile-live-round";
import { readOfflineSavedRounds, requestedOfflineRound } from "./offline-saved-rounds";

function saved(sessionId: string, course = "Bootle"): SavedRound {
  return {
    context: { sessionId, course, tee: "Yellow", courseId: "course" },
    version: "record-v1",
    index: 0,
    dirty: [7],
    inFlight: null,
    holes: [
      {
        holeNumber: 7,
        par: 4,
        yards: 401,
        score: 5,
        putts: 2,
        penalties: 0,
        fairwayHit: null,
        gir: false,
      },
    ],
  };
}
function storage(entries: [string, string][]) {
  const values = new Map(entries);
  return {
    length: values.size,
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
  };
}
describe("offline saved round recovery", () => {
  it("keeps every account-owned round and its pending writes, placing unfinished rounds first", () => {
    const completed = { ...saved("first", "Aintree"), finished: true };
    const pending = {
      ...saved("second"),
      inFlight: { id: "operation-1", version: "record-v1", hole: saved("second").holes[0] },
    };
    const copies = storage([
      ["fkh:live-round:alice:first", JSON.stringify(completed)],
      ["fkh:live-round:bob:private", JSON.stringify(saved("private"))],
      ["fkh:live-round:alice:second", JSON.stringify(pending)],
    ]);
    expect(readOfflineSavedRounds(copies, "alice")).toEqual([pending, completed]);
    expect(readOfflineSavedRounds(copies, "unknown")).toEqual([]);
  });
  it("skips corrupt or mismatched copies independently without deleting raw data", () => {
    const copies = storage([
      ["fkh:live-round:alice:broken", "{"],
      ["fkh:live-round:alice:mismatch", JSON.stringify(saved("wrong-id"))],
      ["fkh:live-round:alice:bad-index", JSON.stringify({ ...saved("bad-index"), index: 5 })],
      ["fkh:live-round:alice:bad-hole", JSON.stringify({ ...saved("bad-hole"), holes: [null] })],
      ["fkh:live-round:alice:good", JSON.stringify(saved("good"))],
    ]);
    expect(readOfflineSavedRounds(copies, "alice")).toEqual([saved("good")]);
    expect(copies.getItem("fkh:live-round:alice:broken")).toBe("{");
    expect(copies.length).toBe(5);
  });
  it("resolves the exact offline round identity without using the first cached round", () => {
    expect(requestedOfflineRound(new URL("https://golf.test/rounds/second?hole=7"))).toBe("second");
    expect(
      requestedOfflineRound(new URL("https://golf.test/offline?view=round&sessionId=second")),
    ).toBe("second");
    for (const path of [
      "/rounds",
      "/rounds/new",
      "/offline",
      "/offline?view=bag&sessionId=second",
      "/rounds/%E0%A4%A",
    ])
      expect(requestedOfflineRound(new URL(path, "https://golf.test"))).toBeNull();
  });
});
