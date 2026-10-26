import type postgres from "postgres";

export async function grantFixturePlan(
  sql: ReturnType<typeof postgres>,
  userIds: readonly string[],
) {
  const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
  if (
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/fkh_redesign"
  ) {
    throw new Error("Paid fixtures require the designated disposable test database.");
  }
  // Call only for freshly created synthetic actors. Account cleanup cascades this row.
  for (const userId of userIds) {
    await sql`insert into fkh_entitlements (user_id, entitlement_key, value_json, source)
      values (${userId}, 'lifetime_full', '{"value":true}', 'isolated-test-fixture')
      on conflict (user_id, entitlement_key) do nothing`;
  }
}
