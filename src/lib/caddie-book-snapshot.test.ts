import { describe, expect, it } from "vitest";
import { buildHoleStrategies } from "./course-strategy";
import {
  caddieBookKey,
  createCaddieBookSnapshot,
  readCaddieBookSnapshot,
  readSavedCaddieBooks,
} from "./caddie-book-snapshot";

const clubs = [
  {
    clubId: "wood",
    label: "5W",
    carryYd: 190,
    minCarryYd: 180,
    maxCarryYd: 200,
    leftYd: 8,
    rightYd: 16,
    confidence: 0.8,
    sampleSize: 25,
  },
];
function snapshot() {
  return createCaddieBookSnapshot(
    {
      accountId: "alice",
      course: { id: "course", name: "Course" },
      tee: { id: "tee", name: "Yellow", yards: 6000 },
      trustedBag: clubs,
      strategy: buildHoleStrategies({
        holes: [
          { holeNumber: 1, par: 4, yards: 350 },
          { holeNumber: 2, par: 3, yards: 175 },
        ],
        clubs,
        hazardsByHole: new Map(),
      }),
      courseMap: {
        imageUrl: "https://images.example.test/course.jpg",
        attribution: "Course mapping",
        bounds: { minX: 0, maxX: 50, minZ: 0, maxZ: 400 },
        holes: [
          {
            holeNumber: 1,
            tee: [0, 0],
            green: [0, 350],
            centerline: [
              [0, 0],
              [0, 350],
            ],
          },
        ],
        features: [
          {
            id: "green",
            holeNumber: 1,
            type: "green",
            rings: [
              [
                [0, 345],
                [10, 350],
                [0, 355],
                [0, 345],
              ],
            ],
          },
        ],
      },
      selectedHole: 2,
      selectedMode: "normal",
    },
    "2026-09-05T09:00:00.000Z",
  );
}
function read(value: unknown, account = "alice") {
  return readCaddieBookSnapshot(JSON.stringify(value), account);
}
describe("saved caddie books", () => {
  it("retains the new evidence basis offline and does not relabel older stock snapshots", () => {
    const original = snapshot();
    expect(read(original)?.strategy[0].strategyModes[0].evidence?.window).toBeUndefined();
    const evidence = original.strategy[0].strategyModes[0].evidence!;
    evidence.window = {
      basis: "latest-reliable",
      latestShotAt: "2026-09-01T12:00:00.000Z",
      lateralSampleSize: 18,
    };
    expect(read(original)?.strategy[0].strategyModes[0].evidence?.window).toEqual(evidence.window);
    evidence.window.latestShotAt = "invalid date";
    expect(read(original)).toBeNull();
  });
  it("keeps exact club evidence, hole selection and save time with self-contained geometry", () => {
    const original = snapshot();
    const saved = read(original)!;
    expect(saved).toEqual(original);
    expect(saved.courseMap?.imageUrl).toBeNull();
    expect(saved.courseMap?.features).toEqual(original.courseMap?.features);
    expect(saved.strategy[0].strategyModes[0].evidence).toMatchObject({
      carryYd: 190,
      leftYd: 8,
      rightYd: 16,
      sampleSize: 25,
    });
    expect(read({ ...saved, selectedHole: 1, selectedMode: "safe" })?.storedAt).toBe(
      original.storedAt,
    );
  });
  it("rejects unknown versions, account mismatch, invalid metrics and duplicate holes", () => {
    const saved = snapshot();
    expect(read(saved, "bob")).toBeNull();
    expect(read({ ...saved, version: 3 })).toBeNull();
    expect(read({ ...saved, storedAt: "not-a-date" })).toBeNull();
    expect(read({ ...saved, strategy: [saved.strategy[0], saved.strategy[0]] })).toBeNull();
    expect(read({ ...saved, trustedBag: [{ ...clubs[0], carryYd: -1 }] })).toBeNull();
    expect(read({ ...saved, strategy: [{ ...saved.strategy[0], par: "4" }] })).toBeNull();
    expect(readCaddieBookSnapshot("{bad json", "alice")).toBeNull();
  });
  it("never accepts malformed map coordinates or follows a cached remote imagery URL", () => {
    const saved = snapshot();
    expect(
      read({
        ...saved,
        courseMap: { ...saved.courseMap, imageUrl: "https://unexpected.example.test/image" },
      })?.courseMap?.imageUrl,
    ).toBeNull();
    expect(
      read({
        ...saved,
        courseMap: {
          ...saved.courseMap,
          holes: [
            {
              ...saved.courseMap!.holes[0],
              centerline: [
                [0, 0],
                ["wrong", 10],
              ],
            },
          ],
        },
      }),
    ).toBeNull();
  });
  it("recovers legacy carries without inventing per-option dispersion or measured ranges", () => {
    const saved = snapshot();
    const legacy = read({ ...saved, version: 1, courseMap: undefined, selectedHole: undefined })!;
    expect(legacy.legacy).toBe(true);
    expect(legacy.courseMap).toBeNull();
    expect(legacy.storedAt).toBe(saved.storedAt);
    expect(legacy.strategy[0].strategyModes[0].evidence).toMatchObject({
      carryYd: 190,
      leftYd: null,
      rightYd: null,
      carryRangeMeasured: false,
    });
    const ambiguous = read({
      ...saved,
      version: 1,
      trustedBag: [clubs[0], { ...clubs[0], clubId: "duplicate" }],
    })!;
    expect(ambiguous.strategy[0].strategyModes[0].evidence).toBeUndefined();
  });
  it("ignores corrupt and mismatched entries without hiding another valid book", () => {
    const saved = snapshot();
    const entries = new Map([
      [caddieBookKey("alice", "course"), JSON.stringify(saved)],
      [caddieBookKey("alice", "broken"), "{invalid"],
      [caddieBookKey("alice", "wrong-key"), JSON.stringify(saved)],
      [caddieBookKey("bob", "course"), JSON.stringify({ ...saved, accountId: "bob" })],
    ]);
    const storage = {
      length: entries.size,
      key: (i: number) => [...entries.keys()][i] ?? null,
      getItem: (key: string) => entries.get(key) ?? null,
    };
    expect(readSavedCaddieBooks(storage, "alice").map((b) => b.course.id)).toEqual(["course"]);
  });
});
