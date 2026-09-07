import { expect, test, type Request } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { hasLocalAuthBypass } from "./helpers";

test.use({ actionTimeout: 15000 });

test("round creation retries once, phone scoring recovers, and completion opens its review", async ({
  page,
  context,
}, testInfo) => {
  const url = process.env.DATABASE_URL;
  const target = url ? new URL(url) : null;
  test.skip(
    !hasLocalAuthBypass ||
      process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" ||
      !target ||
      target.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign",
    "Requires isolated redesign database and disposable account.",
  );
  test.setTimeout(180_000);
  const sql = postgres(url!, { max: 1 });
  let userId: string | undefined;
  const trigger = `redesign_round_${Date.now()}`;
  const foreignRoundId = randomUUID();
  let foreignUserId: string | null = null;
  try {
    userId = (
      await sql`insert into fkh_users(name) values('Synthetic round lifecycle') returning id`
    )[0].id;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: userId, email: "synthetic-round@forekinghell.local" }),
      "playwright",
    ].join(".");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: "localhost",
        path: "/",
      },
    ]);
    const [tee] = await sql`select t.id, t.name, t.course_id, count(h.id)::int as holes
      from fkh_tee_sets t join fkh_courses c on c.id=t.course_id
      join fkh_holes h on h.tee_set_id=t.id where c.visibility='shared'
      group by t.id having count(h.id)>=9 order by count(h.id), t.yards desc limit 1`;
    const query = new URLSearchParams({ courseId: tee.course_id, teeSetId: tee.id });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/surface/workbench?next=${encodeURIComponent(`/rounds/new?${query}`)}`);
    await expect(
      page.locator('input[name="teeSetId"], select[name="teeSetId"]').first(),
    ).toHaveValue(tee.id);
    await page.screenshot({ path: testInfo.outputPath("new-round-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/surface/companion?next=${encodeURIComponent(`/rounds/new?${query}`)}`);
    await expect(page.getByRole("combobox", { name: "Tee", exact: true })).toHaveValue(tee.id);
    await page.getByLabel("Date", { exact: true }).fill("2026-09-01");
    const creationId = await page.locator('input[name="creationId"]').inputValue();
    expect(creationId).toMatch(/^[0-9a-f-]{36}$/);

    await sql.unsafe(`create function ${trigger}() returns trigger language plpgsql as $$
      begin if new.id = '${creationId}'::uuid then raise exception 'deliberate test rejection'; end if;
      return new; end $$`);
    await sql.unsafe(
      `create trigger ${trigger} before insert on fkh_sessions for each row execute function ${trigger}()`,
    );
    await page.getByRole("button", { name: "Start round", exact: true }).click();
    await expect(page.locator("[data-mobile-start-round]").getByRole("alert")).toContainText(
      "Your entries are still here",
    );
    await expect(page.getByRole("combobox", { name: "Tee", exact: true })).toHaveValue(tee.id);
    await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2026-09-01");
    expect(await sql`select id from fkh_sessions where id=${creationId}`).toHaveLength(0);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBe(0);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath("new-round-error-phone.png"),
      fullPage: true,
    });
    await sql.unsafe(`drop function ${trigger}() cascade`);

    let creationRequest: Request | null = null;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.headers()["next-action"] &&
        request.url().includes("/rounds/new")
      )
        creationRequest = request;
    });
    await page.getByRole("button", { name: "Start round", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/rounds/${creationId}`), { timeout: 60_000 });
    await expect(page.locator("[data-mobile-live-round]")).toBeVisible();
    const replay = creationRequest as Request | null;
    expect(replay).toBeTruthy();
    await page.request.post(replay!.url(), {
      headers: replay!.headers(),
      data: replay!.postDataBuffer()!,
    });
    expect(
      await sql`select id from fkh_sessions where id=${creationId} and user_id=${userId!}`,
    ).toHaveLength(1);
    expect(
      await sql`select id from fkh_feed_items where source_id=${creationId} and item_type='round_completed'`,
    ).toHaveLength(0);

    const live = page.locator("[data-mobile-live-round]");
    await live.getByRole("button", { name: "Increase score" }).click();
    await expect(live.getByRole("status")).toHaveText("Saved", { timeout: 20_000 });
    await live.getByRole("button", { name: "Next hole" }).click();
    await page.route("**/api/offline/round-edits", (route) => route.abort("failed"));
    await live.getByRole("button", { name: "Increase score" }).click();
    await expect(live.getByRole("status")).toContainText("waiting to sync", { timeout: 15_000 });
    await page.reload();
    await expect(live.getByRole("heading", { name: "Hole 2", exact: true })).toBeVisible();
    await expect(live.getByRole("button", { name: "Clear score" })).toBeVisible();
    await page.unroute("**/api/offline/round-edits");
    await live.getByRole("button", { name: "Retry sync", exact: true }).click();
    await expect(live.getByRole("status")).toHaveText("Saved", { timeout: 20_000 });
    expect(
      await sql`select achievement_id from fkh_user_achievements where user_id=${userId!} and source_session_id=${creationId} and achievement_id in ('penalty_free', 'break_100', 'break_80')`,
    ).toHaveLength(0);
    await page.screenshot({ path: testInfo.outputPath("live-round-phone.png"), fullPage: true });
    for (let number = 3; number <= tee.holes; number++) {
      await live.getByRole("button", { name: "Next hole" }).click();
      await expect(
        live.getByRole("heading", { name: `Hole ${number}`, exact: true }),
      ).toBeVisible();
      await live.getByRole("button", { name: "Increase score" }).click();
    }
    await live.getByRole("button", { name: "Finish round", exact: true }).click();
    await expect(live.getByRole("button", { name: "Review round", exact: true })).toBeEnabled({
      timeout: 60_000,
    });
    const [saved] =
      await sql`select round_status, scorecard_json from fkh_sessions where id=${creationId} and user_id=${userId!}`;
    expect(saved.round_status).toBe("complete");
    expect(saved.scorecard_json).toHaveLength(tee.holes);
    expect(
      saved.scorecard_json.every((hole: { score: number | null }) => hole.score !== null),
    ).toBe(true);
    expect(
      await sql`select id from fkh_feed_items where source_id=${creationId} and item_type='round_completed'`,
    ).toHaveLength(1);
    await live.getByRole("button", { name: "Review round", exact: true }).click();
    await expect(page.locator("[data-mobile-live-round]")).toHaveCount(0);
    const dismiss = page.getByRole("button", { name: "Dismiss achievement notification" });
    while (await dismiss.count()) {
      await dismiss.first().click();
      await expect(
        page.locator('[data-achievement-toast-viewport] [data-open="false"]'),
      ).toHaveCount(0);
    }
    await page.screenshot({ path: testInfo.outputPath("round-review-phone.png"), fullPage: true });
    await expect(page.getByText("No scored holes over par", { exact: true })).toBeVisible();
    await expect(page.getByText("18 holes at par", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Review round decisions", exact: true }).click();
    const notesForm = page.getByRole("form", { name: "Round review notes" });
    await expect(notesForm).toBeVisible({ timeout: 60_000 });
    await notesForm
      .getByRole("textbox", { name: "What worked or felt different?", exact: true })
      .fill("Kept the ball in play; repeat the same decisions.");
    await sql.unsafe(`create function ${trigger}() returns trigger language plpgsql as $$
      begin if new.id = '${creationId}'::uuid then raise exception 'deliberate notes rejection'; end if;
      return new; end $$`);
    await sql.unsafe(
      `create trigger ${trigger} before update on fkh_sessions for each row execute function ${trigger}()`,
    );
    await notesForm.getByRole("button", { name: "Save review notes" }).click();
    await expect(notesForm.getByRole("alert")).toContainText("They are still here");
    await expect(
      notesForm.getByRole("textbox", { name: "What worked or felt different?", exact: true }),
    ).toHaveValue("Kept the ball in play; repeat the same decisions.");
    await sql.unsafe(`drop function ${trigger}() cascade`);
    let reviewRequest: Request | null = null;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.headers()["next-action"] &&
        request.url().includes("/courses/strategy")
      )
        reviewRequest = request;
    });
    await notesForm.getByRole("button", { name: "Save review notes" }).click();
    await expect(page).toHaveURL(/saved=1/);
    await expect(
      page.getByText("Review notes saved to this round.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      notesForm.getByRole("textbox", { name: "What worked or felt different?", exact: true }),
    ).toHaveValue("Kept the ball in play; repeat the same decisions.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("round-notes-phone.png"), fullPage: true });
    const reviewUrl = `/courses/strategy?mode=post&roundId=${creationId}&${query}`;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/surface/workbench?next=${encodeURIComponent(reviewUrl)}`);
    await expect(
      notesForm.getByRole("textbox", { name: "What felt different?", exact: true }),
    ).toHaveValue("Kept the ball in play; repeat the same decisions.");
    await page.screenshot({ path: testInfo.outputPath("round-notes-desktop.png"), fullPage: true });
    const [other] =
      await sql`insert into fkh_users(name) values('Synthetic foreign round owner') returning id`;
    expect(other).toBeTruthy();
    foreignUserId = other.id;
    await sql`insert into fkh_sessions (id,user_id,source,type,date,round_status,notes,scorecard_json,raw_csv_text)
      select ${foreignRoundId}, ${foreignUserId}, source,type,date,round_status,'Private test notes',scorecard_json,'' from fkh_sessions where id=${creationId}`;
    const noteRequest = reviewRequest as Request | null;
    expect(noteRequest).toBeTruthy();
    const headers = { ...noteRequest!.headers() };
    delete headers["content-length"];
    await page.request.post(noteRequest!.url(), {
      headers,
      data: noteRequest!.postDataBuffer()!.toString().replaceAll(creationId, foreignRoundId),
    });
    const [foreign] =
      await sql`select notes from fkh_sessions where id=${foreignRoundId} and user_id=${foreignUserId}`;
    expect(foreign.notes).toBe("Private test notes");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `/surface/companion?next=${encodeURIComponent(`/courses/strategy?mode=post&roundId=${foreignRoundId}`)}`,
    );
    await expect(
      page.getByText("This completed round is unavailable.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("form", { name: "Round review notes" })).toHaveCount(0);
  } finally {
    await sql.unsafe(`drop function if exists ${trigger}() cascade`);
    if (foreignUserId)
      await sql`delete from fkh_sessions where id=${foreignRoundId} and user_id=${foreignUserId}`;
    if (foreignUserId) await sql`delete from fkh_users where id=${foreignUserId}`;
    if (userId) await sql`delete from fkh_users where id=${userId!}`;
    await sql.end();
  }
});
