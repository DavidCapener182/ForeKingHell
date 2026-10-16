import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { hasLocalAuthBypass } from "./helpers";

test.describe("Pro feature acceptance on a disposable database", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });
  test.skip(!hasLocalAuthBypass, "Synthetic local persona required");
  const userId = "c0c02d1e-605a-47c5-a023-83a1c0d18195";
  const courseId = "e7c4eb7a-6c78-4d25-a85f-cadfa4ecb82d";
  const tag = randomUUID();
  const clubId = randomUUID(),
    sessionId = randomUUID(),
    subscriptionId = randomUUID();
  let db: ReturnType<typeof postgres>;
  let createdCourse = false;
  test.beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL!);
    const local =
      target.hostname === "127.0.0.1" &&
      target.port === "55437" &&
      target.pathname === "/fkh_features";
    const ci =
      process.env.GITHUB_ACTIONS === "true" &&
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
      target.port === "5432" &&
      target.pathname === "/forekinghell";
    if (!local && !ci) throw new Error("Disposable feature database required");
    db = postgres(target.href, { max: 1 });
    await db`insert into fkh_users(id,email,name) values(${userId},'playwright@forekinghell.local','Synthetic browser actor') on conflict do nothing`;
    createdCourse =
      (
        await db`insert into fkh_courses(id,name,visibility) values(${courseId},'Synthetic Ellesmere Port','shared') on conflict do nothing returning id`
      ).length > 0;
    await db`insert into fkh_clubs(id,user_id,type,normalized_club_key) values(${clubId},${userId},'7i',${tag})`;
    await db`insert into fkh_sessions(id,user_id,source,type,date,raw_csv_text) values(${sessionId},${userId},'rapsodo','range',now(),'synthetic browser fixture')`;
    for (let i = 0; i < 10; i++)
      await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,carry_yd,total_yd,side_carry_yd,ball_speed_mph,quality_tag,review_status,source_raw_json) values(${userId},${sessionId},${clubId},'7i',now(),${i + 1},${150 + (i % 3)},${160 + (i % 3)},${i % 2 ? -3 : 4},110,'stock_quality','included','{}')`;
  });
  test.afterEach(async () => {
    await db`delete from fkh_usage_events where user_id=${userId} and source_id=${tag}`;
    await db`delete from fkh_subscriptions where id=${subscriptionId}`;
  });
  test.afterAll(async () => {
    if (!db) return;
    await db`delete from fkh_course_twin_round_plans where user_id=${userId} and course_id=${courseId}`;
    await db`delete from fkh_sessions where id=${sessionId}`;
    await db`delete from fkh_clubs where id=${clubId}`;
    if (createdCourse) await db`delete from fkh_courses where id=${courseId}`;
    await db.end();
  });
  test("Free teaser stops after hole one and direct saves and later-hole requests are forbidden", async ({
    page,
  }) => {
    await page.goto(`/play/${courseId}?mode=plan`);
    await expect(page.getByRole("heading", { name: "Round plan", exact: true })).toBeVisible();
    await expect(page.getByText("Hole 1 of 18", { exact: true })).toBeVisible();
    expect(
      (await page.request.get(`/api/course-twins/${courseId}/strategy?holeNumber=2`)).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(`/api/course-twins/${courseId}/round-plan`, {
          data: { intent: "normal" },
        })
      ).status(),
    ).toBe(403);
    await page.getByRole("button", { name: "Next hole", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Hole 1 unlocked. Full 18 is Pro." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Compare plans", exact: true })).toBeVisible();
  });
  test("Free import warning and wall preserve history and block primary upload", async ({
    page,
  }) => {
    await db`insert into fkh_usage_events(user_id,event_type,quantity,source_id) values(${userId},'subscription_import',4,${tag})`;
    await page.goto("/import?workspace=full&source=csv");
    await expect(
      page.getByText("You have one Free import left this month.", { exact: false }).first(),
    ).toBeVisible();
    await db`update fkh_usage_events set quantity=5 where user_id=${userId} and source_id=${tag}`;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Pause here — your evidence is safe" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Upgrade to Plus — unlimited imports" }).first(),
    ).toBeVisible();
    await expect(page.locator('input[type="file"][accept*="csv"]').first()).toBeDisabled();
  });
  test("Pro navigates holes, changes intent, saves and reloads the owned snapshot", async ({
    page,
  }) => {
    await db`insert into fkh_subscriptions(id,user_id,plan_key,status) values(${subscriptionId},${userId},'pro','active')`;
    await page.goto(`/play/${courseId}?mode=plan`);
    await expect(page.getByRole("heading", { name: "Round plan", exact: true })).toBeVisible();
    await expect(page.getByText(/modelled hazard chance/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Next hole", exact: true }).click();
    await expect(page.getByText("Hole 2 of 18", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next hole", exact: true }).click();
    await expect(page.getByText("Hole 3 of 18", { exact: true })).toBeVisible();
    const intents = page.getByRole("group", { name: "Round plan intent", exact: true });
    await intents.getByRole("button", { name: "Safe", exact: true }).click();
    await expect(intents.getByRole("button", { name: "Safe", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await intents.getByRole("button", { name: "Normal", exact: true }).click();
    await page.getByRole("button", { name: "Save plan", exact: true }).click();
    await expect(
      page.getByText("Round plan saved. Reopen this course before tee-off."),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Saved hole plan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export saved plan" })).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath("round-plan.png"), fullPage: true });
    const result = await page.request.get(`/api/course-twins/${courseId}/round-plan`);
    const { plan } = await result.json();
    expect(plan.userId).toBe(userId);
    expect(plan.holesJson).toHaveLength(18);
    expect(
      (
        await page.request.post(`/api/course-twins/${courseId}/round-plan`, {
          data: { intent: "normal", userId: randomUUID() },
        })
      ).status(),
    ).toBe(400);
  });
});
