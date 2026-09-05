import type { HoleStrategy, HoleStrategyMode } from "./course-strategy";
import type { CourseStrategyMap } from "./course-strategy-map";

type SavedClub = {
  clubId: string;
  label: string;
  carryYd: number;
  minCarryYd: number;
  maxCarryYd: number;
  confidence: number;
  sampleSize: number;
};
export type CaddieBookSnapshot = {
  version: 2;
  accountId: string;
  course: { id: string; name: string };
  tee: { id: string; name: string; yards: number | null } | null;
  storedAt: string;
  strategy: HoleStrategy[];
  trustedBag: SavedClub[];
  courseMap: CourseStrategyMap | null;
  selectedHole: number;
  selectedMode: HoleStrategyMode["id"];
  legacy?: boolean;
};

export function caddieBookKey(accountId: string, courseId: string) {
  return `fkh:round-download:${accountId}:${courseId}`;
}

export function createCaddieBookSnapshot(
  input: Omit<CaddieBookSnapshot, "version" | "storedAt" | "legacy">,
  storedAt = new Date().toISOString(),
): CaddieBookSnapshot {
  return {
    ...input,
    version: 2,
    storedAt,
    // Save the mapped vectors, not a dependency on remote aerial imagery.
    courseMap: input.courseMap ? { ...input.courseMap, imageUrl: null } : null,
  };
}

/** Local evidence is never accepted for another account or silently given a new save date. */
export function readCaddieBookSnapshot(
  raw: string | null,
  accountId: string,
): CaddieBookSnapshot | null {
  try {
    if (!raw || raw.length > 4_000_000) return null;
    const saved: unknown = JSON.parse(raw);
    if (
      !record(saved) ||
      ![1, 2].includes(saved.version as number) ||
      saved.accountId !== accountId ||
      !identity(saved.course) ||
      !(saved.tee === null || identity(saved.tee)) ||
      !text(saved.storedAt) ||
      !Number.isFinite(Date.parse(saved.storedAt)) ||
      !Array.isArray(saved.strategy) ||
      !saved.strategy.length ||
      saved.strategy.length > 36 ||
      !saved.strategy.every(hole) ||
      new Set(saved.strategy.map((h) => h.holeNumber)).size !== saved.strategy.length ||
      !Array.isArray(saved.trustedBag) ||
      saved.trustedBag.length > 100 ||
      !saved.trustedBag.every(club)
    )
      return null;
    if (saved.tee && !(saved.tee.yards === null || distance(saved.tee.yards))) return null;
    if (saved.version === 2 && !(saved.courseMap === null || map(saved.courseMap))) return null;
    const strategy = saved.strategy as HoleStrategy[];
    const trustedBag = saved.trustedBag as SavedClub[];
    const legacy = saved.version === 1 || saved.legacy === true;
    const selectedHole = strategy.some((h) => h.holeNumber === saved.selectedHole)
      ? (saved.selectedHole as number)
      : strategy[0].holeNumber;
    const selectedMode = modeId(saved.selectedMode) ? saved.selectedMode : "normal";
    return {
      version: 2,
      accountId,
      course: saved.course,
      tee: saved.tee as CaddieBookSnapshot["tee"],
      storedAt: saved.storedAt,
      strategy:
        saved.version === 1
          ? strategy.map((h) => ({
              ...h,
              strategyModes: h.strategyModes.map((m) => restoreLegacyMode(m, trustedBag)),
            }))
          : strategy,
      trustedBag,
      courseMap:
        saved.version === 2 && saved.courseMap
          ? { ...(saved.courseMap as CourseStrategyMap), imageUrl: null }
          : null,
      selectedHole,
      selectedMode,
      ...(legacy ? { legacy: true } : {}),
    };
  } catch {
    return null;
  }
}

export function readSavedCaddieBooks(
  storage: Pick<Storage, "length" | "key" | "getItem">,
  accountId: string,
) {
  const books: CaddieBookSnapshot[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(`fkh:round-download:${accountId}:`)) continue;
    const book = readCaddieBookSnapshot(storage.getItem(key), accountId);
    if (book && key === caddieBookKey(accountId, book.course.id)) books.push(book);
  }
  return books.sort((a, b) => Date.parse(b.storedAt) - Date.parse(a.storedAt));
}

function restoreLegacyMode(mode: HoleStrategyMode, clubs: SavedClub[]): HoleStrategyMode {
  const matches = clubs.filter((c) => c.label === mode.club);
  const c = matches.length === 1 ? matches[0] : null;
  if (!c) {
    return { ...mode, evidence: undefined };
  }
  return {
    ...mode,
    evidence: {
      clubId: c.clubId,
      carryYd: c.carryYd,
      minCarryYd: c.minCarryYd,
      maxCarryYd: c.maxCarryYd,
      leftYd: null,
      rightYd: null,
      carryRangeMeasured: false,
      sampleSize: c.sampleSize,
      confidence: "Low",
    },
  };
}
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function text(v: unknown): v is string {
  return typeof v === "string" && v.length <= 4000;
}
function identity(v: unknown): v is Record<string, unknown> & { id: string; name: string } {
  return record(v) && text(v.id) && v.id.length > 0 && text(v.name) && v.name.length > 0;
}
function distance(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 20_000;
}
function count(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}
function nullableDistance(v: unknown) {
  return v === null || distance(v);
}
function modeId(v: unknown): v is HoleStrategyMode["id"] {
  return v === "safe" || v === "normal" || v === "aggressive";
}
function confidence(v: unknown) {
  return v === "Low" || v === "Moderate" || v === "High";
}
function club(v: unknown) {
  return (
    record(v) &&
    text(v.clubId) &&
    !!v.clubId &&
    text(v.label) &&
    distance(v.carryYd) &&
    distance(v.minCarryYd) &&
    distance(v.maxCarryYd) &&
    v.minCarryYd <= v.maxCarryYd &&
    distance(v.confidence) &&
    v.confidence <= 1 &&
    count(v.sampleSize)
  );
}
function mode(v: unknown) {
  if (
    !record(v) ||
    !modeId(v.id) ||
    !["Safe", "Normal", "Aggressive"].includes(v.label as string) ||
    ![v.club, v.carryRange, v.target, v.expectedLeave, v.rationale].every(text)
  )
    return false;
  const e = v.evidence;
  return (
    e === undefined ||
    (record(e) &&
      text(e.clubId) &&
      distance(e.carryYd) &&
      distance(e.minCarryYd) &&
      distance(e.maxCarryYd) &&
      e.minCarryYd <= e.maxCarryYd &&
      nullableDistance(e.leftYd) &&
      nullableDistance(e.rightYd) &&
      typeof e.carryRangeMeasured === "boolean" &&
      count(e.sampleSize) &&
      (e.window === undefined || evidenceWindow(e.window)) &&
      confidence(e.confidence))
  );
}
function evidenceWindow(v: unknown) {
  return (
    record(v) &&
    v.basis === "latest-reliable" &&
    count(v.lateralSampleSize) &&
    (v.latestShotAt === null ||
      (text(v.latestShotAt) && Number.isFinite(Date.parse(v.latestShotAt))))
  );
}
function hole(v: unknown) {
  return (
    record(v) &&
    count(v.holeNumber) &&
    v.holeNumber >= 1 &&
    v.holeNumber <= 36 &&
    count(v.par) &&
    v.par >= 1 &&
    v.par <= 8 &&
    distance(v.yards) &&
    [
      v.recommendedClub,
      v.expectedCarryRange,
      v.commonMiss,
      v.safeTarget,
      v.hazardWarning,
      v.conservativeAlternative,
      v.expectedLeave,
      v.caveat,
    ].every(text) &&
    [v.personalCarryYd, v.dispersionLeftYd, v.dispersionRightYd, v.expectedLeaveYd].every(
      nullableDistance,
    ) &&
    confidence(v.confidence) &&
    Array.isArray(v.hazards) &&
    v.hazards.length <= 100 &&
    v.hazards.every(text) &&
    Array.isArray(v.followUpClubs) &&
    v.followUpClubs.length <= 10 &&
    v.followUpClubs.every((c) => record(c) && text(c.label) && text(c.expectedCarryRange)) &&
    Array.isArray(v.strategyModes) &&
    v.strategyModes.length <= 3 &&
    v.strategyModes.every(mode) &&
    new Set(v.strategyModes.map((m) => m.id)).size === v.strategyModes.length
  );
}
function point(v: unknown) {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100_000_000)
  );
}
function map(v: unknown): v is CourseStrategyMap {
  if (
    !record(v) ||
    !record(v.bounds) ||
    !Object.values(v.bounds).every((n) => typeof n === "number" && Number.isFinite(n)) ||
    !(
      typeof v.bounds.minX === "number" &&
      typeof v.bounds.maxX === "number" &&
      v.bounds.maxX > v.bounds.minX &&
      typeof v.bounds.minZ === "number" &&
      typeof v.bounds.maxZ === "number" &&
      v.bounds.maxZ > v.bounds.minZ
    ) ||
    !(v.attribution === null || text(v.attribution)) ||
    !Array.isArray(v.holes) ||
    v.holes.length > 36 ||
    !Array.isArray(v.features) ||
    v.features.length > 3000
  )
    return false;
  return (
    v.holes.every(
      (h) =>
        record(h) &&
        count(h.holeNumber) &&
        point(h.tee) &&
        point(h.green) &&
        Array.isArray(h.centerline) &&
        h.centerline.length >= 2 &&
        h.centerline.length <= 2000 &&
        h.centerline.every(point),
    ) &&
    v.features.every(
      (f) =>
        record(f) &&
        text(f.id) &&
        (f.holeNumber === null || count(f.holeNumber)) &&
        ["tee", "fairway", "green", "bunker", "water"].includes(f.type as string) &&
        Array.isArray(f.rings) &&
        f.rings.length <= 100 &&
        f.rings.every(
          (r) => Array.isArray(r) && r.length >= 3 && r.length <= 10000 && r.every(point),
        ),
    )
  );
}
