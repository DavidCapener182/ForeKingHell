import { expect, test, type Page, type Request } from "@playwright/test";
import postgres from "postgres";
import { hasLocalAuthBypass, injectAxe } from "./helpers";
import { canRunMutatingCompanionE2e, MutatingCompanionFixture } from "./mutating-companion-fixture";

test("round context completion and tee corrections preserve scorecards and enforce ownership", async ({
  page,
}, testInfo) => {
  const url = process.env.DATABASE_URL;
  const target = url ? new URL(url) : null;
  test.skip(
    !hasLocalAuthBypass ||
      !canRunMutatingCompanionE2e ||
      !target ||
      !["localhost", "127.0.0.1"].includes(target.hostname) ||
      target.pathname !== "/fkh_redesign",
    "Requires isolated redesign fixtures.",
  );
  test.setTimeout(180_000);
  const sql = postgres(url!, { max: 1 });
  const user = process.env.PLAYWRIGHT_MUTATING_TEST_USER_ID!;
  const fixture = new MutatingCompanionFixture();
  const key = `round_context_${Date.now()}`;
  const courseIds: string[] = [];
  let foreignUserId: string | null = null;
  let lastRequest: Request | null = null;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) lastRequest = request;
  });
  try {
    const [base] =
      await sql`select t.id,t.course_id,c.name from fkh_tee_sets t join fkh_courses c on c.id=t.course_id where c.visibility='shared' and (select count(*) from fkh_holes h where h.tee_set_id=t.id)=18 order by t.id limit 1`;
    const originalHoles =
      await sql`select hole_number,par,yards,stroke_index from fkh_holes where tee_set_id=${base.id} order by hole_number`;
    const card = originalHoles.slice(0, 9).map((hole, index) => ({
      holeNumber: hole.hole_number,
      par: hole.par,
      yards: hole.yards,
      strokeIndex: hole.stroke_index,
      name: null,
      score: index === 8 ? null : hole.par,
      putts: null,
      penalties: null,
    }));
    const [round] =
      await sql`insert into fkh_sessions(user_id,source,type,date,round_status,course_id,tee_set_id,course_name,scorecard_json,raw_csv_text) values(${user},'manual','real_round','2026-09-02T12:00:00Z','in_progress',${base.course_id},${base.id},${base.name},${sql.json(card)},'') returning id`;
    fixture.trackSession(round.id);
    const [foreignUser] = await sql`insert into fkh_users(name) values(${key}) returning id`;
    foreignUserId = foreignUser.id;
    const [foreignRound] =
      await sql`insert into fkh_sessions(user_id,source,type,date,round_status,scorecard_json,raw_csv_text) values(${foreignUser.id},'manual','real_round',now(),'in_progress',${sql.json(card)},'') returning id`;
    const tees: Record<string, string> = {};
    for (const [name, owner, count] of [
      ["Replacement", user, 18],
      ["Empty", user, 0],
      ["Short", user, 8],
      ["Private", foreignUser.id, 18],
    ] as const) {
      const [course] =
        await sql`insert into fkh_courses(name,visibility,created_by_user_id) values(${key + name},'private',${owner}) returning id`;
      courseIds.push(course.id);
      const [tee] =
        await sql`insert into fkh_tee_sets(course_id,name,par) values(${course.id},${name},72) returning id`;
      tees[name] = tee.id;
      await sql`insert into fkh_holes(course_id,tee_set_id,hole_number,par,yards,stroke_index,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson)
        select ${course.id},${tee.id},hole_number,par,yards+10,stroke_index,tee_lat,tee_lng,green_lat,green_lng,centerline_geojson from fkh_holes where tee_set_id=${base.id} and hole_number<=${count}`;
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `/surface/workbench?next=${encodeURIComponent(`/rounds/${round.id}?view=corrections`)}`,
    );
    const context = page.locator("#context");
    await expect(context).toContainText("1 remaining hole");
    await context.getByRole("combobox", { name: "Status", exact: true }).click();
    await expect(page.getByRole("option", { name: "Complete", exact: true })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.keyboard.press("Escape");
    await context
      .getByRole("textbox", { name: "Round notes", exact: true })
      .fill("Retain these context notes");
    await sql.unsafe(
      `create function ${key}() returns trigger language plpgsql as $$ begin if new.id='${round.id}'::uuid then raise exception 'deliberate context rejection'; end if; return new; end $$`,
    );
    await sql.unsafe(
      `create trigger ${key} before update on fkh_sessions for each row execute function ${key}()`,
    );
    await context.getByRole("button", { name: "Save context", exact: true }).click();
    await expect(context.getByRole("alert")).toContainText("Your entries are still here");
    await expect(context.getByRole("textbox", { name: "Round notes", exact: true })).toHaveValue(
      "Retain these context notes",
    );
    await sql.unsafe(`drop function ${key}() cascade`);
    await context.getByRole("button", { name: "Save context", exact: true }).click();
    await expect(context.getByRole("alert")).toContainText("Saved just now");
    const contextRequest = lastRequest!;
    expect((await replayAction(page, contextRequest, { roundStatus: "complete" })).status).toBe(
      500,
    );
    expect((await replayAction(page, contextRequest, { roundStatus: "unexpected" })).status).toBe(
      500,
    );
    const [unfinished] =
      await sql`select round_status,notes from fkh_sessions where id=${round.id}`;
    expect(unfinished).toMatchObject({
      round_status: "in_progress",
      notes: "Retain these context notes",
    });
    expect(
      await sql`select id from fkh_feed_items where source_id=${round.id} and item_type='round_completed'`,
    ).toHaveLength(0);
    await page
      .locator("summary")
      .filter({ hasText: /^Hole-by-hole scorecard/ })
      .click();
    const lastHole = page.locator("#hole-9");
    await lastHole.getByLabel("Score", { exact: true }).fill(String(originalHoles[8].par));
    await lastHole.getByRole("button", { name: "Save hole", exact: true }).click();
    await expect(lastHole.getByRole("alert")).toContainText("Saved just now");
    const holeRequest = lastRequest!;
    await page.reload();
    await context.getByRole("combobox", { name: "Status", exact: true }).click();
    await page.getByRole("option", { name: "Complete", exact: true }).click();
    await context.getByRole("button", { name: "Save context", exact: true }).click();
    await expect(context.getByRole("alert")).toContainText("Saved just now");
    const completedRequest = lastRequest!;
    expect((await replayAction(page, completedRequest, {})).status).toBe(200);
    const [completed] =
      await sql`select round_status,scorecard_json from fkh_sessions where id=${round.id}`;
    expect(completed.round_status).toBe("complete");
    expect(
      await sql`select id from fkh_feed_items where source_id=${round.id} and item_type='round_completed'`,
    ).toHaveLength(1);
    expect((await replayAction(page, contextRequest, { sessionId: foreignRound.id })).status).toBe(
      500,
    );
    const course = page.locator("#course-link");
    await course.getByRole("combobox").click();
    await expect(page.getByRole("option", { name: new RegExp(key + "Private") })).toHaveCount(0);
    await page.getByRole("option", { name: new RegExp(key + "Replacement") }).click();
    await course.getByRole("button", { name: "Update link", exact: true }).click();
    await expect(course.getByRole("alert")).toContainText("Saved just now");
    const courseRequest = lastRequest!;
    const [linked] =
      await sql`select tee_set_id,scorecard_json,notes from fkh_sessions where id=${round.id}`;
    expect(linked.tee_set_id).toBe(tees.Replacement);
    expect(linked.scorecard_json).toHaveLength(9);
    expect(linked.scorecard_json.map((hole: { score: number }) => hole.score)).toEqual(
      completed.scorecard_json.map((hole: { score: number }) => hole.score),
    );
    expect(linked.scorecard_json[0].yards).toBe(card[0].yards + 10);
    expect(linked.notes).toBe("Retain these context notes");
    for (const tee of [tees.Empty, tees.Short, tees.Private])
      expect((await replayAction(page, courseRequest, { teeSetId: tee })).status).toBe(500);
    expect((await replayAction(page, courseRequest, { sessionId: foreignRound.id })).status).toBe(
      500,
    );
    const [stillLinked] =
      await sql`select tee_set_id,scorecard_json from fkh_sessions where id=${round.id}`;
    expect(stillLinked).toEqual({
      tee_set_id: linked.tee_set_id,
      scorecard_json: linked.scorecard_json,
    });
    const parallel = await Promise.all([
      replayAction(page, courseRequest, { teeSetId: base.id }),
      replayAction(page, holeRequest, { holeNumber: "1", score: "6" }),
    ]);
    expect(parallel.map((response) => response.status)).toEqual([200, 200]);
    const [final] =
      await sql`select tee_set_id,scorecard_json from fkh_sessions where id=${round.id}`;
    expect(final.tee_set_id).toBe(base.id);
    expect(final.scorecard_json).toHaveLength(9);
    expect(final.scorecard_json[0]).toMatchObject({ score: 6, yards: card[0].yards });
    const [foreign] =
      await sql`select round_status,scorecard_json,notes from fkh_sessions where id=${foreignRound.id}`;
    expect(foreign).toEqual({ round_status: "in_progress", scorecard_json: card, notes: null });
    const [privateTee] = await sql`select course_id from fkh_tee_sets where id=${tees.Private}`;
    await sql`update fkh_sessions set course_id=${privateTee.course_id},tee_set_id=${tees.Private} where id=${round.id}`;
    await page.reload();
    await expect(course).toContainText("The linked tee is no longer available");
    expect(await page.content()).not.toContain(key + "Private");
    const [retained] = await sql`select scorecard_json from fkh_sessions where id=${round.id}`;
    expect(retained.scorecard_json).toEqual(final.scorecard_json);
    await sql`update fkh_sessions set course_id=${base.course_id},tee_set_id=${base.id} where id=${round.id}`;
    await page.reload();
    await expect(context).toBeVisible();
    await injectAxe(page);
    expect(
      await page.evaluate(
        async () =>
          (
            await (
              window as unknown as {
                axe: {
                  run: (context: string, options: unknown) => Promise<{ violations: unknown[] }>;
                };
              }
            ).axe.run("#context, #course-link", {
              runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
            })
          ).violations,
      ),
    ).toEqual([]);
    const disclosure = page.locator("summary").filter({ hasText: /^Hole-by-hole scorecard/ });
    const summaryBox = await disclosure.boundingBox();
    const titleBox = await disclosure.locator(":scope > span").first().boundingBox();
    expect(titleBox!.x - summaryBox!.x).toBeLessThanOrEqual(24);
    await page.screenshot({ path: testInfo.outputPath("context-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `/surface/companion?next=${encodeURIComponent(`/rounds/${round.id}?view=evidence`)}`,
    );
    await page.locator("summary").filter({ hasText: "Notes and score details" }).click();
    await expect(page.getByRole("textbox", { name: "Round notes", exact: true })).toHaveValue(
      "Retain these context notes",
    );
    const phoneNotes = page.getByRole("textbox", { name: "Round notes", exact: true });
    const phoneForm = page.locator("form").filter({ has: phoneNotes });
    await phoneNotes.fill("Saved from the phone review");
    await phoneForm.getByRole("button", { name: "Save round context", exact: true }).click();
    await expect(phoneForm.getByRole("alert")).toContainText("Saved just now");
    const [phoneSaved] = await sql`select notes from fkh_sessions where id=${round.id}`;
    expect(phoneSaved.notes).toBe("Saved from the phone review");
    await injectAxe(page);
    expect(
      await phoneForm.evaluate(
        async (form) =>
          (
            await (
              window as unknown as {
                axe: {
                  run: (element: Element, options: unknown) => Promise<{ violations: unknown[] }>;
                };
              }
            ).axe.run(form, {
              runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
            })
          ).violations,
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath("context-phone.png"), fullPage: true });
    expect(pageErrors).toEqual([]);
  } finally {
    await sql.unsafe(`drop function if exists ${key}() cascade`);
    await fixture.cleanup();
    for (const id of courseIds) await sql`delete from fkh_courses where id=${id}`;
    if (foreignUserId) await sql`delete from fkh_users where id=${foreignUserId}`;
    await sql.end();
  }
});

async function replayAction(page: Page, request: Request, overrides: Record<string, string>) {
  const payload = await new Response(request.postData()!, {
    headers: { "content-type": request.headers()["content-type"] },
  }).formData();
  const fields = Object.fromEntries(
    [...payload].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
  for (const [name, value] of Object.entries(overrides)) {
    const key = Object.keys(fields).find((key) => key === name || key.endsWith(`_${name}`));
    if (!key) throw new Error(`Missing action field ${name}`);
    fields[key] = value;
  }
  const headers = Object.fromEntries(
    Object.entries(request.headers()).filter(([key]) =>
      ["next-action", "next-router-state-tree"].includes(key),
    ),
  );
  return page.evaluate(
    async ({ url, headers, fields }) => {
      const body = new FormData();
      Object.entries(fields)
        .filter(([key]) => key !== "0")
        .forEach(([key, value]) => body.append(key, value));
      body.append("0", fields["0"]);
      const response = await fetch(url, { method: "POST", headers, body });
      return { status: response.status };
    },
    { url: request.url(), headers, fields },
  );
}
