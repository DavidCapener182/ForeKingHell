import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Challenge detail preserves evidence drafts and explicit scoped actions on both surfaces", async ({
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
          `/surface/${surface}?next=${encodeURIComponent(`/challenges/${challenge}?invite=sent`)}`,
        );
        await page.addStyleTag({ content: "nextjs-portal { pointer-events:none !important; }" });
        await expect(
          page.getByRole("heading", {
            name: "Synthetic championship detail with full long identity",
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.getByText("Invite sent", { exact: true })).toHaveCount(0);
        const tabs = page.getByRole("tablist", { name: "Challenge sections" });
        await tabs.getByRole("tab", { name: "Attempts", exact: true }).click();
        const panel = page.getByRole("tabpanel", { name: "Attempts", exact: true });
        await panel.locator("summary").first().click();
        await expect(panel).toContainText("250.0 yd");
        await expect(
          panel.getByRole("link", { name: "Open latest qualifying source session", exact: true }),
        ).toHaveAttribute("href", `/sessions/${session}`);
        await tabs.getByRole("tab", { name: "Rules", exact: true }).click();
        await expect(page.getByRole("tabpanel", { name: "Rules", exact: true })).toContainText(
          "Driver",
        );
        await tabs.getByRole("tab", { name: /Chat/ }).click();
        const chat = page.getByRole("tabpanel", { name: /Chat/ });
        const body = `Synthetic comment ${surface} ${width}`;
        await chat.getByRole("textbox", { name: "Comment", exact: true }).fill(body);
        await tabs.getByRole("tab", { name: "Board", exact: true }).click();
        await tabs.getByRole("tab", { name: /Chat/ }).click();
        await expect(chat.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue(body);
        await chat.getByRole("button", { name: "Send comment", exact: true }).click();
        await expect(chat.getByRole("status")).toContainText("Comment saved");
        await expect(chat.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue("");
        await expect(chat.getByText(body, { exact: true })).toBeVisible();
        expect(
          await db`select id from fkh_challenge_comments where challenge_id=${challenge} and body=${body}`,
        ).toHaveLength(1);
        await tabs.getByRole("tab", { name: "Command board", exact: true }).click();
        await page.getByRole("button", { name: "Invite friends", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await dialog.getByLabel("Search friends", { exact: true }).fill("Synthetic friend");
        await dialog.getByLabel("Friend to invite", { exact: true }).selectOption(friend!);
        await dialog.getByRole("button", { name: "Review invitation", exact: true }).click();
        await expect(dialog).toContainText("public");
        const before =
          await db`select id from fkh_challenge_invites where challenge_id=${challenge}`;
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(
          await db`select id from fkh_challenge_invites where challenge_id=${challenge}`,
        ).toHaveLength(before.length);
        await page.getByRole("button", { name: "Invite friends", exact: true }).click();
        await dialog.getByRole("button", { name: "Send reviewed invitation", exact: true }).click();
        await expect(dialog.getByRole("status")).toContainText("Invitation saved");
        expect(
          await db`select id from fkh_challenge_invites where challenge_id=${challenge} and invitee_user_id=${friend!}`,
        ).toHaveLength(1);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P59-${surface}-${width}.png`),
          animations: "disabled",
        });
        await login(friend!);
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/challenges/${challenge}`)}`,
        );
        await page.addStyleTag({ content: "nextjs-portal { pointer-events:none !important; }" });
        await page.getByRole("button", { name: "Join challenge", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
        expect(
          await db`select id from fkh_challenge_entries where challenge_id=${challenge} and user_id=${friend!}`,
        ).toHaveLength(0);
        await page.getByRole("button", { name: "Join challenge", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Confirm entry", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "Leave challenge", exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Leave challenge", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Keep entry", exact: true })
          .click();
        expect(
          await db`select id from fkh_challenge_entries where challenge_id=${challenge} and user_id=${friend!}`,
        ).toHaveLength(1);
        await page.getByRole("button", { name: "Leave challenge", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Confirm leave", exact: true })
          .click();
        await expect(page).toHaveURL(/\/challenges\?tab=active/);
        expect(
          await db`select id from fkh_challenge_entries where challenge_id=${challenge} and user_id=${friend!}`,
        ).toHaveLength(0);
      }
    expect(await db`select id from fkh_shots where session_id=${session}`).toHaveLength(2);
    expect(
      (await db`select raw_csv_text from fkh_sessions where id=${session}`)[0].raw_csv_text,
    ).toBe("unchanged challenge source");
    expect(errors).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    if (friend) await db`delete from fkh_users where id=${friend}`;
    if (template) await db`delete from fkh_challenge_templates where id=${template}`;
    await db.end();
  }
});
