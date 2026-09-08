import { expect as baseExpect, test } from "@playwright/test";
import postgres from "postgres";
const expect = baseExpect.configure({ timeout: 30000 });
test("Challenge own-source inspection explains exclusions and pages on both surfaces", async ({
  page,
  context,
}, info) => {
  const value = process.env.DATABASE_URL;
  const target = value ? new URL(value) : null;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
    "Designated fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  let friend: string | undefined;
  let template: string | undefined;
  const login = async (id: string) => {
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    await context.clearCookies();
    await context.addCookies([
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(
          JSON.stringify({
            access_token: [
              encode({ alg: "none" }),
              encode({ sub: id, email: "detail@forekinghell.local" }),
              "playwright",
            ].join("."),
          }),
        ),
        domain: "localhost",
        path: "/",
      },
    ]);
  };
  try {
    const ids = (
      await db`insert into fkh_users(name) values('Synthetic detail owner'),('Synthetic detail friend') returning id`
    ).map((r) => r.id);
    [owner, friend] = ids;
    for (const id of ids)
      await db`insert into fkh_user_profiles(user_id,username,display_name) values(${id},${id.replaceAll("-", "")},${id === owner ? "Synthetic owner with a long player identity" : "Synthetic friend with a long player identity"})`;
    const pair = ids.slice().sort();
    await db`insert into fkh_friendships(user_a_id,user_b_id) values(${pair[0]},${pair[1]})`;
    template = (
      await db`insert into fkh_challenge_templates(slug,name,description,challenge_type,rules_json) values(${crypto.randomUUID()},'Synthetic detail long drive','Imported drivers only','longest_drive','{"minShots":1,"clubTypes":["driver"]}'::jsonb) returning id`
    )[0].id;
    const challenge = (
      await db`insert into fkh_challenges(template_id,creator_user_id,title,visibility,status,starts_at,ends_at) values(${template!},${owner!},'Synthetic championship detail with full long identity','public','open',now()-interval '1 day',now()+interval '1 day') returning id`
    )[0].id;
    await db`insert into fkh_challenge_entries(challenge_id,user_id,status) values(${challenge},${owner!},'joined')`;
    const session = (
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${owner!},'csv','range',now(),'unchanged challenge source') returning id`
    )[0].id;
    const club = (
      await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner!},'driver','detail-fixture') returning id`
    )[0].id;
    await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,review_status,source_raw_json) values(${owner!},${session},${club},'driver',now(),1,250,'included','{}'::jsonb),(${owner!},${session},${club},'driver',now(),2,999,'user_excluded','{}'::jsonb)`;
    for (let n = 0; n < 25; n++)
      await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,shot_number,total_yd,review_status,source_raw_json) values(${owner!},${session},${club},'iron',now(),${100 + n},100,'included','{}'::jsonb)`;
    const original =
      await db`select id,total_yd,review_status from fkh_shots where user_id=${owner!} order by id`;
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await login(owner!);
        await page.setViewportSize({ width, height });
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/challenges/${challenge}?tab=attempts`)}`,
        );
        const inspection = page.locator("#source-inspection");
        await expect(inspection).toBeVisible();
        await expect(inspection.locator("[data-challenge-source]")).toHaveCount(24);
        await expect(inspection).toContainText("27 saved sources");
        await inspection.locator("summary").first().click();
        await expect(inspection).toContainText("Club does not match");
        await inspection.getByRole("link", { name: "Next sources", exact: true }).click();
        await expect(page).toHaveURL(/sourcePage=2/);
        await expect(inspection.locator("[data-challenge-source]")).toHaveCount(3);
        const excluded = inspection.locator("details").filter({ hasText: "review excludes" });
        await excluded.locator("summary").click();
        await expect(excluded.getByRole("link", { name: "Open source session" })).toHaveAttribute(
          "href",
          `/sessions/${session}`,
        );
        await expect(excluded).toContainText("999");
        await expect(excluded).toContainText("user excluded");
        await page.reload();
        await expect(inspection.locator("[data-challenge-source]")).toHaveCount(3);
        await inspection.getByRole("link", { name: "Previous sources", exact: true }).click();
        await expect(inspection.locator("[data-challenge-source]")).toHaveCount(24);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        if (width === 1440 || width === 390)
          await inspection.screenshot({
            path: info.outputPath(`P59-sources-${surface}-${width}.png`),
          });
      }
    expect(errors).toEqual([]);
    expect(
      await db`select id,total_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    if (friend) await db`delete from fkh_users where id=${friend}`;
    if (template) await db`delete from fkh_challenge_templates where id=${template}`;
    await db.end();
  }
});
