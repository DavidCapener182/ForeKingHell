import { expect, test } from "@playwright/test";
import postgres from "postgres";
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
  try {
    const [source] =
      await sql`select id from fkh_sessions where user_id=${user} order by date asc limit 1`;
    expect(source).toBeTruthy();
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
      encode({ sub: "02a77bc2-93c8-4c7b-8995-ddc099782904", email: "empty@forekinghell.local" }),
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
    await sql.end();
  }
});
