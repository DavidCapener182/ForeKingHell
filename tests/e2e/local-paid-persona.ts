import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { test } from "@playwright/test";
import { hasLocalAuthBypass } from "./helpers";

// Scan the intended paid pages, rather than their streamed billing redirect.
// The synthetic persona is only provisioned against a disposable loopback database.
export function registerLocalPaidPersona() {
  const accessibilitySubscriptionId = randomUUID();
  let accessibilityDb: ReturnType<typeof postgres> | undefined;

  test.beforeAll(async () => {
    if (!hasLocalAuthBypass) return;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
      throw new Error("Local accessibility persona requires a loopback test database.");
    }
    accessibilityDb = postgres(databaseUrl, { max: 1 });
    const userId = "c0c02d1e-605a-47c5-a023-83a1c0d18195";
    await accessibilityDb`
    insert into fkh_users (id, email, name)
    values (${userId}, 'playwright@forekinghell.local', 'Playwright')
    on conflict (id) do nothing
  `;
    await accessibilityDb`
    insert into fkh_subscriptions (id, user_id, plan_key, status)
    values (${accessibilitySubscriptionId}, ${userId}, 'full', 'active')
  `;
  });

  test.afterAll(async () => {
    if (!accessibilityDb) return;
    try {
      await accessibilityDb`delete from fkh_subscriptions where id = ${accessibilitySubscriptionId}`;
    } finally {
      await accessibilityDb.end();
    }
  });
  return async function withFlightPathFixture(run: (sessionId?: string) => Promise<void>) {
    if (!accessibilityDb) return run();
    const clubId = randomUUID();
    const sessionId = randomUUID();
    const userId = "c0c02d1e-605a-47c5-a023-83a1c0d18195";
    try {
      await accessibilityDb`
        insert into fkh_clubs (id, user_id, type, normalized_club_key)
        values (${clubId}, ${userId}, '7i', ${`accessibility-${clubId}`})
      `;
      await accessibilityDb`
        insert into fkh_sessions (id, user_id, source, type, date, raw_csv_text)
        values (${sessionId}, ${userId}, 'rapsodo', 'practice', now(), 'synthetic accessibility fixture')
      `;
      await accessibilityDb`
        insert into fkh_shots (user_id, session_id, club_id, shot_at, club_type, shot_number,
          carry_yd, total_yd, side_carry_yd, source_raw_json)
        values (${userId}, ${sessionId}, ${clubId}, now(), '7i', 1, 150, 160, -5, '{"fixture":"accessibility"}')
      `;
      await run(sessionId);
    } finally {
      await accessibilityDb`delete from fkh_sessions where id = ${sessionId}`;
      await accessibilityDb`delete from fkh_clubs where id = ${clubId}`;
    }
  };
}
