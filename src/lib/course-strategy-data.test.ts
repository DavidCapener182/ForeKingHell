import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mock = vi.hoisted(() => ({ results: [] as unknown[][], conditions: [] as unknown[] }));
const mobileBag = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mobile-quick-bag-data", () => ({ getMobileQuickBag: mobileBag }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUserId: async () => "owner" }));
vi.mock("@/db/client", () => ({
  getDb: () => ({
    select: () => {
      const rows = mock.results.shift() ?? [];
      const query = {
        from: () => query,
        innerJoin: () => query,
        orderBy: () => query,
        limit: () => query,
        where: (condition: unknown) => {
          mock.conditions.push(condition);
          return query;
        },
        then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
      };
      return query;
    },
  }),
}));

import { getCourseStrategyData } from "./course-strategy-data";

const course = { id: "11111111-1111-4111-8111-111111111111", name: "Requested course" };
const tee = {
  id: "22222222-2222-4222-8222-222222222222",
  courseId: course.id,
  name: "Requested tee",
  yards: 6000,
};

beforeEach(() => {
  mock.results.length = 0;
  mock.conditions.length = 0;
  mobileBag.mockReset();
});

describe("strategy data identity and current evidence", () => {
  it("resolves a valid course and tee beyond the bounded option lists", async () => {
    mock.results.push([], [course], [], [], [], [tee], []);
    const data = await getCourseStrategyData(course.id, tee.id);
    expect(data.selectedCourse?.id).toBe(course.id);
    expect(data.selectedTee?.id).toBe(tee.id);
    expect(data.courseOptions).toContainEqual(course);
    expect(data.teeOptions).toContainEqual(tee);
    const dialect = new PgDialect();
    const teePredicate = mock.conditions
      .map((condition) => dialect.sqlToQuery(condition as Parameters<typeof dialect.sqlToQuery>[0]))
      .find((query) => query.params.includes(tee.id));
    expect(teePredicate?.params).toEqual([tee.id, course.id]);
    const courseQueries = mock.conditions
      .map((condition) => dialect.sqlToQuery(condition as Parameters<typeof dialect.sqlToQuery>[0]))
      .filter((query) => query.sql.includes('"visibility"'));
    expect(courseQueries).toHaveLength(2);
    expect(
      courseQueries.every(
        (query) => query.params.includes("shared") && query.params.includes("owner"),
      ),
    ).toBe(true);
  });

  it("does not substitute a different course for an invalid explicit deep link", async () => {
    mock.results.push([course]);
    const data = await getCourseStrategyData("invalid-id");
    expect(data.selectedCourse).toBeNull();
    expect(data.strategies).toEqual([]);
  });

  it("does not substitute a different tee when an explicit tee is unavailable", async () => {
    mock.results.push([course], [{ ...tee, id: "other-tee" }], [], [], []);
    const data = await getCourseStrategyData(course.id, tee.id);
    expect(data.selectedTee).toBeNull();
    expect(data.strategies).toEqual([]);
  });

  it("keeps the newest stock row instead of overwriting it with older evidence", async () => {
    const stock = {
      clubId: "club",
      type: "5w",
      sampleSize: 30,
      p25: null,
      p75: null,
      left: 12,
      right: 10,
      confidence: 0.9,
    };
    mock.results.push(
      [course],
      [tee],
      [],
      [
        { ...stock, carry: 190 },
        { ...stock, carry: 150 },
      ],
      [{ holeNumber: 1, par: 4, yards: 350 }],
    );
    const data = await getCourseStrategyData(course.id, tee.id);
    expect(data.trustedBag).toHaveLength(1);
    expect(mobileBag).not.toHaveBeenCalled();
    expect(data.trustedBag[0].carryYd).toBe(190);
    expect(data.strategies[0].personalCarryYd).toBe(190);
    expect(data.strategies[0].strategyModes[0].evidence?.carryRangeMeasured).toBe(false);
    const dialect = new PgDialect();
    const scopedQueries = mock.conditions.map((condition) =>
      dialect.sqlToQuery(condition as Parameters<typeof dialect.sqlToQuery>[0]),
    );
    expect(
      scopedQueries.some((query) => query.params.includes("owner") && query.params.includes(true)),
    ).toBe(true);
  });
  it("uses the mobile Bag window for companion strategy without querying stored stock", async () => {
    mobileBag.mockResolvedValue([
      {
        id: "club",
        clubType: "5w",
        label: "5 Wood",
        evidenceKind: "full",
        trustedCarryYd: 172,
        lowYd: 165,
        highYd: 178,
        sampleSize: 20,
        patternSampleSize: 18,
        observedLeftYd: 11,
        observedRightYd: 25,
        latestEvidenceDate: "2026-09-01T10:00:00.000Z",
        confidence: 80,
      },
    ]);
    mock.results.push([course], [tee], [], [{ holeNumber: 1, par: 4, yards: 350 }]);
    const data = await getCourseStrategyData(course.id, tee.id, "latest-reliable");
    expect(mobileBag).toHaveBeenCalledOnce();
    expect(data.strategies[0].personalCarryYd).toBe(172);
    expect(data.strategies[0].strategyModes[0].evidence).toMatchObject({
      carryYd: 172,
      minCarryYd: 165,
      maxCarryYd: 178,
      leftYd: 11,
      rightYd: 25,
      window: { basis: "latest-reliable", lateralSampleSize: 18 },
    });
    expect(mock.results).toHaveLength(0);
    const dialect = new PgDialect();
    expect(
      mock.conditions
        .map((c) => dialect.sqlToQuery(c as Parameters<typeof dialect.sqlToQuery>[0]).sql)
        .join(" "),
    ).not.toContain("stock_yardages");
  });
});
