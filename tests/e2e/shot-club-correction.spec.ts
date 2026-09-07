import { expect, test, type Page, type Request } from "@playwright/test";
import postgres from "postgres";
import { hasLocalAuthBypass } from "./helpers";
import { canRunMutatingCompanionE2e, MutatingCompanionFixture } from "./mutating-companion-fixture";

test("round and Shot Explorer club corrections share atomic evidence refresh and retry", async ({
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
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(60_000);
  const sql = postgres(url!, { max: 1 });
  const user = process.env.PLAYWRIGHT_MUTATING_TEST_USER_ID!;
  const fixture = new MutatingCompanionFixture();
  const key = `club_correction_${Date.now()}`;
  const clubIds: string[] = [];
  let request: Request | null = null;
  let foreignUserId: string | null = null;
  try {
    const [foreign] = await sql`insert into fkh_users(name) values(${key}) returning id`;
    foreignUserId = foreign.id;
    const [foreignClub] =
      await sql`insert into fkh_clubs(user_id,type,normalized_club_key) values(${foreign.id},'pw',${key}) returning id`;
    const [iron] =
      await sql`insert into fkh_clubs(user_id,type,brand,normalized_club_key) values(${user},'7i',${key + " iron"},${key + " iron"}) returning id`;
    const [wedge] =
      await sql`insert into fkh_clubs(user_id,type,brand,normalized_club_key) values(${user},'pw',${key + " wedge"},${key + " wedge"}) returning id`;
    clubIds.push(iron.id, wedge.id);
    const card = [
      {
        holeNumber: 1,
        par: 4,
        yards: 350,
        score: 4,
        putts: 1,
        puttsSource: "manual",
        penalties: 1,
        notes: "Keep this note",
      },
    ];
    const [round] =
      await sql`insert into fkh_sessions(user_id,source,type,play_context,date,file_name,raw_csv_text,round_status,course_name,scorecard_json)
      values(${user},'csv','simulated_course','course','2026-09-06T12:00:00Z',${key},'Raw CSV must survive','complete','Correction test round',${sql.json(card)}) returning id`;
    fixture.trackSession(round.id);
    const createdShots: string[] = [];
    for (const [index, carry] of [200, 80].entries()) {
      const [shot] =
        await sql`insert into fkh_shots(user_id,session_id,club_id,club_type,play_context,shot_at,shot_number,course_hole_number,carry_yd,total_yd,side_carry_yd,ball_speed_mph,review_status,review_confidence,source_raw_json)
        values(${user},${round.id},${iron.id},'7i','course','2026-09-06T12:00:00Z',${index + 1},1,${carry},${carry},3,100,'included',0.42,'{"Club":"7 Iron","Side":"3R","fixture":"raw unchanged"}'::jsonb) returning id`;
      createdShots.push(shot.id);
    }
    const shotId = createdShots[1];
    const raw = async () =>
      (
        await sql`select carry_yd,total_yd,side_carry_yd,ball_speed_mph,review_status,review_confidence,source_raw_json from fkh_shots where id=${shotId}`
      )[0];
    const original = await raw();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(
      `/surface/workbench?next=${encodeURIComponent(`/rounds/${round.id}?view=corrections`)}`,
    );
    const form = page
      .locator("form")
      .filter({ has: page.locator(`input[name="shotId"][value="${shotId}"]`) })
      .filter({ has: page.getByRole("button", { name: "Save", exact: true }) });
    await expect(page.getByRole("region", { name: "Round correction tools" })).toBeVisible();
    await page
      .locator("summary")
      .filter({ hasText: /^Shot corrections/ })
      .click();
    await form.getByRole("combobox").selectOption(wedge.id);
    await sql.unsafe(
      `create function ${key}() returns trigger language plpgsql as $$ begin if new.session_id='${round.id}'::uuid then raise exception 'deliberate derived evidence rejection'; end if; return new; end $$`,
    );
    await sql.unsafe(
      `create trigger ${key} before insert on fkh_strokes_gained_shot_events for each row execute function ${key}()`,
    );
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Your entries are still here");
    expect((await sql`select club_id from fkh_shots where id=${shotId}`)[0].club_id).toBe(iron.id);
    expect(await sql`select id from fkh_shot_review_events where shot_id=${shotId}`).toHaveLength(
      0,
    );
    await sql.unsafe(`drop function ${key}() cascade`);
    page.on("request", (value) => {
      if (
        value.method() === "POST" &&
        value.headers()["next-action"] &&
        value.url().includes(round.id)
      )
        request = value;
    });
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Saved just now");
    expect(
      (await sql`select club_id,shot_category from fkh_shots where id=${shotId}`)[0],
    ).toMatchObject({ club_id: wedge.id, shot_category: "pitch" });
    expect(await raw()).toEqual(original);
    expect(
      (await sql`select scorecard_json,raw_csv_text from fkh_sessions where id=${round.id}`)[0],
    ).toMatchObject({
      raw_csv_text: "Raw CSV must survive",
      scorecard_json: [
        expect.objectContaining({
          putts: 1,
          puttsSource: "manual",
          penalties: 1,
          notes: "Keep this note",
        }),
      ],
    });
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.id} and shot_id is not null`,
    ).toHaveLength(2);
    const stock =
      await sql`select club_id,sample_size from fkh_stock_yardages where club_id in ${sql(clubIds)} order by club_id`;
    expect(stock).toHaveLength(2);
    expect(stock.find((row) => row.club_id === wedge.id)?.sample_size).toBe(0); // A pitch must not become a full-swing stock distance.
    const recorded = request as Request | null;
    expect(recorded).not.toBeNull();
    expect((await replayAction(page, recorded!, {})).status).toBe(200);
    expect(await sql`select id from fkh_shot_review_events where shot_id=${shotId}`).toHaveLength(
      1,
    );
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.id} and shot_id is not null`,
    ).toHaveLength(2);
    expect((await replayAction(page, recorded!, { clubId: foreignClub.id })).status).toBe(500);
    expect((await replayAction(page, recorded!, { sessionId: crypto.randomUUID() })).status).toBe(
      500,
    );
    expect((await sql`select club_id from fkh_shots where id=${shotId}`)[0].club_id).toBe(wedge.id);
    await page.screenshot({
      path: testInfo.outputPath("round-club-corrected.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      `/surface/companion?next=${encodeURIComponent(`/shots?sessionId=${round.id}`)}`,
    );
    await page.getByRole("button", { name: /80 yards carry.*view shot/ }).click();
    const correction = page
      .locator("details")
      .filter({ has: page.locator("summary").filter({ hasText: /^Correct club$/ }) });
    await correction.locator("summary").click();
    await correction.getByLabel("Club", { exact: true }).selectOption(iron.id);
    await correction.getByRole("button", { name: "Update club", exact: true }).click();
    await expect(correction.getByRole("status")).toContainText("Club updated");
    expect(
      (await sql`select club_id,shot_category from fkh_shots where id=${shotId}`)[0],
    ).toMatchObject({ club_id: iron.id, shot_category: "approach" });
    expect(await raw()).toEqual(original);
    expect(await sql`select id from fkh_shot_review_events where shot_id=${shotId}`).toHaveLength(
      2,
    );
    expect(
      await sql`select id from fkh_strokes_gained_shot_events where session_id=${round.id} and shot_id is not null`,
    ).toHaveLength(2);
    await correction.getByRole("button", { name: "Undo club change", exact: true }).click();
    await expect
      .poll(async () => (await sql`select club_id from fkh_shots where id=${shotId}`)[0].club_id)
      .toBe(wedge.id);
    expect(await raw()).toEqual(original);
    await page.screenshot({
      path: testInfo.outputPath("shot-explorer-club-corrected.png"),
      fullPage: true,
    });
  } finally {
    await sql.unsafe(`drop function if exists ${key}() cascade`);
    await fixture.cleanup();
    for (const id of clubIds) {
      await sql`delete from fkh_stock_yardages where club_id=${id} and user_id=${user}`;
      await sql`delete from fkh_clubs where id=${id} and user_id=${user}`;
    }
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
