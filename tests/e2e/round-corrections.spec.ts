import { expect, test, type Request } from "@playwright/test";
import postgres from "postgres";
import { hasLocalAuthBypass, injectAxe } from "./helpers";

test("scorecard corrections are discoverable, recover after failure and preserve unrelated evidence", async ({
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
    "Requires isolated redesign fixtures.",
  );
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const sql = postgres(url!, { max: 1 });
  let user: string | undefined;
  const trigger = `round_correction_${Date.now()}`;
  let request: Request | null = null;
  let foreignUserId: string | null = null;
  try {
    user = (
      await sql`insert into fkh_users(name) values('Synthetic round corrections') returning id`
    )[0].id;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: user, email: "synthetic-corrections@forekinghell.local" }),
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
    await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${user!},'7i','synthetic-7i')`;
    const [tee] =
      await sql`select t.id,t.course_id,c.name from fkh_tee_sets t join fkh_courses c on c.id=t.course_id where c.visibility='shared' and exists(select 1 from fkh_holes h where h.tee_set_id=t.id) order by t.id limit 1`;
    const holes =
      await sql`select hole_number,par,yards,stroke_index from fkh_holes where tee_set_id=${tee.id} order by hole_number`;
    const scorecard = holes.map((hole) => ({
      holeNumber: hole.hole_number,
      par: hole.par,
      yards: hole.yards,
      strokeIndex: hole.stroke_index,
      score: hole.par,
      putts: null,
      penalties: null,
      gir: null,
      fairwayHit: null,
    }));
    const [round] =
      await sql`insert into fkh_sessions(user_id,source,type,date,round_status,course_id,tee_set_id,course_name,scorecard_json,raw_csv_text)
      values(${user!},'manual','real_round','2026-09-02T12:00:00Z','complete',${tee.course_id},${tee.id},${tee.name},${sql.json(scorecard)},'') returning id`;

    const route = `/rounds/${round.id}?view=scorecard`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/surface/companion?next=${encodeURIComponent(route)}`);
    await expect(page.getByRole("tab", { name: "Scorecard", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("No scorecard holes are saved.", { exact: true })).toHaveCount(0);
    const form = page.locator("#mobile-hole-1");
    const details = page.locator("details").filter({ has: form });
    await details.locator("summary").click();
    await form.getByLabel("Score", { exact: true }).fill("5");
    await form.getByLabel("Putts", { exact: true }).fill("3");
    await form.getByLabel("Penalties", { exact: true }).fill("1");
    await sql.unsafe(
      `create function ${trigger}() returns trigger language plpgsql as $$ begin if new.id='${round.id}'::uuid then raise exception 'deliberate correction rejection'; end if; return new; end $$`,
    );
    await sql.unsafe(
      `create trigger ${trigger} before update on fkh_sessions for each row execute function ${trigger}()`,
    );
    await form.getByRole("button", { name: "Save hole 1", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Your entries are still here");
    await expect(form.getByLabel("Score", { exact: true })).toHaveValue("5");
    await expect(form.getByLabel("Putts", { exact: true })).toHaveValue("3");
    await sql.unsafe(`drop function ${trigger}() cascade`);
    page.on("request", (value) => {
      if (
        value.method() === "POST" &&
        value.headers()["next-action"] &&
        value.url().includes(round.id)
      )
        request = value;
    });
    await form.getByRole("button", { name: "Save hole 1", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Saved just now");
    const [saved] = await sql`select scorecard_json from fkh_sessions where id=${round.id}`;
    expect(saved.scorecard_json[0]).toMatchObject({ score: 5, putts: 3, penalties: 1 });
    expect(saved.scorecard_json[1]).toMatchObject({
      score: holes[1].par,
      putts: null,
      penalties: null,
    });
    await page.reload();
    await expect(page.getByRole("tab", { name: "Scorecard", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await details.locator("summary").click();
    await expect(form.getByLabel("Score", { exact: true })).toHaveValue("5");
    await injectAxe(page);
    const violations = await page.evaluate(async () => {
      const axe = (
        window as unknown as {
          axe: { run: (context: string, options: unknown) => Promise<{ violations: unknown[] }> };
        }
      ).axe;
      return (
        await axe.run("#mobile-round-scorecard", {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        })
      ).violations;
    });
    expect(violations).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: testInfo.outputPath("scorecard-correction-phone.png"),
      fullPage: true,
    });
    await form.getByLabel("Score", { exact: true }).fill("9");
    await details.locator("summary").click();
    await details.locator("summary").click();
    await expect(form.getByLabel("Score", { exact: true })).toHaveValue("9");
    await page.getByRole("tab", { name: "Summary", exact: true }).click();
    await expect(form).toHaveCount(1);
    await expect(form).toBeHidden();
    await page.goBack();
    await expect(page.getByRole("tab", { name: "Scorecard", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(form.getByLabel("Score", { exact: true })).toHaveValue("9");
    await form.getByLabel("Score", { exact: true }).fill("5");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `/surface/workbench?next=${encodeURIComponent(`/rounds/${round.id}?view=corrections`)}`,
    );
    await page
      .locator("summary")
      .filter({ hasText: /^Hole-by-hole scorecard/ })
      .click();
    const desktop = page.locator("#hole-1");
    await expect(desktop.getByLabel("Score", { exact: true })).toHaveValue("5");
    await desktop.getByLabel("Score", { exact: true }).fill("6");
    await desktop.getByRole("button", { name: "Save hole", exact: true }).click();
    await expect(desktop.getByRole("alert")).toContainText("Saved just now");
    await page.screenshot({
      path: testInfo.outputPath("scorecard-correction-desktop.png"),
      fullPage: true,
    });
    const recorded = request as Request | null;
    expect(recorded).not.toBeNull();
    const payload = await new Response(recorded!.postData()!, {
      headers: { "content-type": recorded!.headers()["content-type"] },
    }).formData();
    const fields: Record<string, string> = Object.fromEntries(
      [...payload].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
    expect(
      Object.entries(fields).some(
        ([key, value]) => key.endsWith("sessionId") && value === round.id,
      ),
    ).toBe(true);
    const holeKey = Object.keys(fields).find(
      (key) => key === "holeNumber" || key.endsWith("_holeNumber"),
    )!;
    const scoreKey = Object.keys(fields).find((key) => key === "score" || key.endsWith("_score"))!;
    expect(holeKey).toBeTruthy();
    expect(scoreKey).toBeTruthy();
    const headers = Object.fromEntries(
      Object.entries(recorded!.headers()).filter(([key]) =>
        ["next-action", "next-router-state-tree"].includes(key),
      ),
    );
    const sendCorrections = (overrides: Record<string, string>[]) =>
      page.evaluate(
        async ({ url, headers, fields, overrides }) =>
          Promise.all(
            overrides.map(async (override) => {
              const body = new FormData();
              const entries = Object.entries({
                ...fields,
                ...override,
              });
              // Flight resolves the root as it streams in, after its referenced form fields.
              entries
                .filter(([key]) => key !== "0")
                .forEach(([key, value]) => body.append(key, value));
              body.append("0", fields["0"]);
              const response = await fetch(url, { method: "POST", headers, body });
              return {
                status: response.status,
                error: response.ok ? null : (await response.text()).slice(0, 500),
              };
            }),
          ),
        { url: recorded!.url(), headers, fields, overrides },
      );
    const results = await sendCorrections(
      [2, 3].map((holeNumber) => ({
        [holeKey]: String(holeNumber),
        [scoreKey]: String(holeNumber + 5),
      })),
    );
    expect(results).toEqual([
      { status: 200, error: null },
      { status: 200, error: null },
    ]);
    const [concurrent] = await sql`select scorecard_json from fkh_sessions where id=${round.id}`;
    expect(
      concurrent.scorecard_json.slice(0, 3).map((hole: { score: number }) => hole.score),
    ).toEqual([6, 7, 8]);
    const [club] =
      await sql`select id,type from fkh_clubs where user_id=${user!} order by id limit 1`;
    expect(club).toBeTruthy();
    for (const [index, holeNumber] of [1, 1, 4, 4].entries()) {
      await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,play_context,shot_at,shot_number,course_hole_number,carry_yd,review_status,source_raw_json)
        values(${user!},${round.id},${club.id},${club.type},'course',now(),${index + 1},${holeNumber},100,'included','{}'::jsonb)`;
    }
    const puttsKey = Object.keys(fields).find((key) => key.endsWith("_putts"))!;
    expect(puttsKey).toBeTruthy();
    const [manualSave] = await sendCorrections([
      { [holeKey]: "1", [scoreKey]: "8", [puttsKey]: "1" },
    ]);
    expect(manualSave.status).toBe(200);
    const [manual] = await sql`select scorecard_json from fkh_sessions where id=${round.id}`;
    expect(manual.scorecard_json[0]).toMatchObject({ score: 8, putts: 1, puttsSource: "manual" });
    expect(manual.scorecard_json[3].putts).toBe(scorecard[3].score - 2);
    const [clearedSave] = await sendCorrections([
      { [holeKey]: "1", [scoreKey]: "8", [puttsKey]: "" },
    ]);
    expect(clearedSave.status).toBe(200);
    const [cleared] = await sql`select scorecard_json from fkh_sessions where id=${round.id}`;
    expect(cleared.scorecard_json[0]).toMatchObject({ putts: null, puttsSource: "manual" });
    const [foreignUser] =
      await sql`insert into fkh_users(name) values('Round correction owner fixture') returning id`;
    foreignUserId = foreignUser.id;
    const [foreignRound] =
      await sql`insert into fkh_sessions(user_id,source,type,date,round_status,scorecard_json,raw_csv_text)
      values(${foreignUser.id},'manual','real_round',now(),'complete',${sql.json(scorecard)},'') returning id`;
    const sessionKey = Object.keys(fields).find((key) => key.endsWith("_sessionId"))!;
    expect(sessionKey).toBeTruthy();
    const [denied] = await sendCorrections([{ [sessionKey]: foreignRound.id, [scoreKey]: "10" }]);
    expect(denied.status).toBe(500);
    expect(denied.error).toContain("Round scorecard hole not found");
    const [unchanged] =
      await sql`select scorecard_json from fkh_sessions where id=${foreignRound.id}`;
    expect(unchanged.scorecard_json).toEqual(scorecard);
  } finally {
    await sql.unsafe(`drop function if exists ${trigger}() cascade`);
    if (user) await sql`delete from fkh_users where id=${user!}`;
    if (foreignUserId) await sql`delete from fkh_users where id=${foreignUserId}`;
    await sql.end();
  }
});
