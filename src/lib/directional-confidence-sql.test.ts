import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { shots } from "@/db/schema";
import { directionalMetricSql } from "./directional-confidence-sql";

describe("directional projection SQL", () => {
  it("keeps outer shot and owner references qualified even in a single-table select", () => {
    const db = drizzle.mock();
    const query = db
      .select({ side: directionalMetricSql(shots.sideCarryYd) })
      .from(shots)
      .toSQL();
    expect(query.sql).toContain('direction_session.id = "fkh_shots"."session_id"');
    expect(query.sql).toContain('direction_session.user_id = "fkh_shots"."user_id"');
    expect(query.sql).toContain('("fkh_shots"."id"::text)');
    expect(query.sql).toContain('as "trusted_side_carry_yd"');
  });
  it("can be referenced safely through ranked subqueries", () => {
    const db = drizzle.mock();
    const ranked = db
      .select({ side: directionalMetricSql(shots.sideCarryYd) })
      .from(shots)
      .as("ranked");
    expect(() => db.select({ side: ranked.side }).from(ranked).toSQL()).not.toThrow();
  });
});
