import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { hasLocalAuthBypass } from "./helpers";
import { canRunMutatingCompanionE2e, MutatingCompanionFixture } from "./mutating-companion-fixture";

test("review context survives regeneration, save and a desktop saved-plan deep link", async ({
  page,
  browser,
}) => {
  const databaseUrl = process.env.DATABASE_URL;
  const target = databaseUrl ? new URL(databaseUrl) : null;
  test.skip(
    !hasLocalAuthBypass ||
      !canRunMutatingCompanionE2e ||
      !target ||
      !["localhost", "127.0.0.1"].includes(target.hostname) ||
      target.pathname !== "/fkh_redesign",
    "Requires the isolated redesign database.",
  );
  test.setTimeout(120_000);
  const sql = postgres(databaseUrl!, { max: 1 });
  const user = process.env.PLAYWRIGHT_MUTATING_TEST_USER_ID!;
  const fixture = new MutatingCompanionFixture();
  let clubId: string | undefined;
  const otherUserId = randomUUID();
  try {
    const fileName = `practice-handoff-${randomUUID()}.csv`;
    fixture.trackFileName(fileName);
    const [club] =
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${user},'7i',${fileName}) returning id`;
    clubId = club.id;
    const [source] =
      await sql`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${user},'rapsodo','range',now(),${fileName},'Synthetic handoff evidence') returning id`;
    fixture.trackSession(source.id);
    for (let i = 1; i <= 3; i++)
      await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,carry_yd,total_yd,review_status,source_raw_json) values(${user},${source.id},${club.id},'7i',now(),${i},${150 + i},${160 + i},'included','{}'::jsonb)`;
    await sql`insert into fkh_users(id,email,name) values(${otherUserId},${`${otherUserId}@example.test`},'Practice handoff outsider')`;
    await page.setViewportSize({ width: 390, height: 844 });
    // Verify compatibility with the original import-result links too.
    await page.goto(
      `/surface/companion?next=${encodeURIComponent(`/practice?session=${source.id}&club=7i&intent=latest_weakness&time=20`)}`,
    );
    const evidence = page.locator("[data-practice-source-session]");
    await expect(evidence).toHaveAttribute("data-practice-source-session", source.id);
    await page.getByRole("radio", { name: "30 min", exact: true }).click();
    await expect(page.locator("[data-current-practice-plan]")).toContainText(/30\s*min/);
    await expect(evidence).toHaveAttribute("data-practice-source-session", source.id);
    await page.getByRole("button", { name: "Start practice", exact: true }).click();
    const range = page.locator("[data-active-range-mode]");
    await expect(range).toBeVisible();
    const planId = await range.getAttribute("data-practice-plan-id");
    expect(planId).toBeTruthy();
    fixture.trackPracticePlan(planId);
    const [saved] =
      await sql`select context_json from fkh_practice_plans where id=${planId} and user_id=${user}`;
    expect(saved.context_json.latestPractice.sessionId).toBe(source.id);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/surface/workbench?next=${encodeURIComponent(`/practice?planId=${planId}`)}`);
    await expect(evidence).toHaveAttribute("data-practice-source-session", source.id);
    await expect(page.locator("[data-practice-training-workspace]")).toHaveAttribute(
      "data-practice-plan-id",
      planId!,
    );
    await page.reload();
    await expect(evidence).toHaveAttribute("data-practice-source-session", source.id);

    // Multiple linked plans must still produce one history row and one shot count.
    await sql`update fkh_practice_plans set source_session_id=${source.id}, practice_score=41
      where id=${planId} and user_id=${user}`;
    const [secondPlan] = await sql`insert into fkh_practice_plans
      (user_id, source_session_id, session_type, time_minutes, energy_level, intent,
        title, generated_summary, practice_score, updated_at)
      select user_id, source_session_id, session_type, time_minutes, energy_level, intent,
        'History regression fixture', generated_summary, 92, now() + interval '1 second'
      from fkh_practice_plans where id=${planId} and user_id=${user} returning id`;
    fixture.trackPracticePlan(secondPlan.id);
    const [shotCount] = await sql`select count(*)::int as count from fkh_shots
      where session_id=${source.id} and user_id=${user}`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/surface/companion?next=%2Fsessions");
    const historyRow = page.locator(
      `[aria-label="Session history"] a[href="/sessions/${source.id}"]`,
    );
    await expect(historyRow).toHaveCount(1);
    await expect(historyRow).toContainText(`${shotCount.count} shots`);
    await expect(historyRow).toContainText("92/100");

    // An account without this source or plan must never receive its context.
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: otherUserId, email: "empty@forekinghell.local" }),
      "playwright",
    ].join(".");
    const isolated = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
    await isolated.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    const otherPage = await isolated.newPage();
    for (const query of [
      `sourceSessionId=${source.id}`,
      `planId=${planId}`,
      "sourceSessionId=invalid",
    ]) {
      await otherPage.goto(`/surface/workbench?next=${encodeURIComponent(`/practice?${query}`)}`);
      await expect(
        otherPage.getByText(/couldn.t find|not found|unavailable/i).first(),
      ).toBeVisible();
      await expect(otherPage.locator("[data-practice-source-session]")).toHaveCount(0);
    }
    await isolated.close();
  } finally {
    await fixture.cleanup();
    if (clubId) await sql`delete from fkh_clubs where id=${clubId} and user_id=${user}`;
    await sql`delete from fkh_users where id=${otherUserId}`;
    await sql.end();
  }
});
