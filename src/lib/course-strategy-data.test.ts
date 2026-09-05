import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mock = vi.hoisted(() => ({ results: [] as unknown[][], conditions: [] as unknown[] }));
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
    expect(data.trustedBag[0].carryYd).toBe(190);
    expect(data.strategies[0].personalCarryYd).toBe(190);
    const dialect = new PgDialect();
    const scopedQueries = mock.conditions.map((condition) =>
      dialect.sqlToQuery(condition as Parameters<typeof dialect.sqlToQuery>[0]),
    );
    expect(
      scopedQueries.some((query) => query.params.includes("owner") && query.params.includes(true)),
    ).toBe(true);
  });
});
