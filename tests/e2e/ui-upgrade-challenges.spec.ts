import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Challenges retain all status views rules and reviewed creation on both surfaces", async ({
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
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  let templateId: string | undefined;
  try {
    owner = (
      await db`insert into fkh_users(name) values('Synthetic challenge UI owner') returning id`
    )[0].id;
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "challenges@forekinghell.local" }),
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
    const marker = `UI ${crypto.randomUUID().slice(0, 8)}`;
    templateId = (
      await db`insert into fkh_challenge_templates(slug,name,description,challenge_type,rules_json) values(${crypto.randomUUID()},${marker + " long drive objective"},'Imported driver shots inside the scoring window','longest_drive','{"minShots":3,"clubTypes":["driver"]}'::jsonb) returning id`
    )[0].id;
    for (const [name, status, joined] of [
      ["Active", "open", true],
      ["Available", "open", false],
      ["Completed", "completed", true],
      ["Closed", "closed", false],
    ] as const) {
      const id = (
        await db`insert into fkh_challenges(template_id,creator_user_id,title,visibility,status,starts_at,ends_at) values(${templateId!},${owner!},${marker + " " + name + " long championship challenge identity"},'public',${status},now()-interval '1 day',now()+interval '10 days') returning id`
      )[0].id;
      if (joined)
        await db`insert into fkh_challenge_entries(challenge_id,user_id,status) values(${id},${owner!},'joined')`;
    }
    for (const surface of ["workbench", "companion"])
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(
          `/surface/${surface}?next=${encodeURIComponent(`/challenges?tab=active&q=${encodeURIComponent(marker)}`)}`,
        );
        // The development-only Next indicator can overlap modal controls; keep it visible but non-interactive.
        await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });
        const workspace = page.locator("[data-challenge-workspace]");
        const tabs = workspace.getByRole("tablist", { name: "Challenge status" });
        await expect(workspace.locator("[data-challenge-row]").first()).toContainText(
          "0 / 3 qualifying shots",
        );
        await workspace.getByRole("button", { name: "Rules", exact: true }).first().click();
        const rules = page.getByRole("dialog");
        await expect(rules).toContainText("Visibility");
        await rules.getByRole("button", { name: "Close rules", exact: true }).click();
        await expect(
          workspace.getByRole("button", { name: "Rules", exact: true }).first(),
        ).toBeFocused();
        await tabs.getByRole("tab", { name: /Completed/ }).click();
        await expect(page).toHaveURL(/tab=completed/);
        await expect(workspace.locator("[data-challenge-row]")).toHaveCount(1);
        await expect(workspace.locator("[data-challenge-row]")).toContainText(
          "No qualifying result",
        );
        await page.reload();
        await page.addStyleTag({ content: "nextjs-portal { pointer-events: none !important; }" });
        await expect(tabs.getByRole("tab", { name: /Completed/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await tabs.getByRole("tab", { name: /Available/ }).click();
        await expect(page).toHaveURL(/tab=available/);
        await expect(
          workspace.getByRole("button", { name: "Joining unavailable", exact: true }),
        ).toBeDisabled();
        await expect(workspace.locator("[data-challenge-row]")).toHaveCount(2);
        await page.screenshot({
          path: info.outputPath(`P58-board-${surface}-${width}.png`),
          animations: "disabled",
        });
        await workspace.getByRole("button", { name: "Create challenge", exact: true }).click();
        const form = page.getByRole("dialog");
        await form.getByLabel("Challenge objective", { exact: true }).selectOption(templateId!);
        await form
          .getByLabel("Challenge name", { exact: true })
          .fill(marker + " created " + surface + width);
        await form.getByLabel("Starts (UTC)", { exact: true }).fill("2026-09-07");
        await form.getByLabel("Ends (UTC)", { exact: true }).fill("2026-09-06");
        await form.getByRole("button", { name: "Review challenge", exact: true }).click();
        await expect(form.getByRole("alert")).toContainText("End date");
        await form.getByLabel("Ends (UTC)", { exact: true }).fill("2026-10-07");
        await form.getByRole("button", { name: "Review challenge", exact: true }).click();
        await expect(form).toContainText("public");
        await form.getByRole("button", { name: "Cancel", exact: true }).click();
        await workspace.getByRole("button", { name: "Create challenge", exact: true }).click();
        await expect(form).toContainText(marker + " created " + surface + width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(`P58-${surface}-${width}.png`),
          animations: "disabled",
          fullPage: false,
        });
        await form.getByRole("button", { name: "Create reviewed challenge", exact: true }).click();
        await expect(page).toHaveURL(/\/challenges\/[a-f0-9-]+/);
        const id = new URL(page.url()).pathname.split("/").pop()!;
        const [created] =
          await db`select visibility,starts_at,ends_at,challenge_rules_json from fkh_challenges where id=${id} and creator_user_id=${owner!}`;
        expect(created.visibility).toBe("public");
        expect(new Date(created.starts_at).toISOString().slice(0, 10)).toBe("2026-09-07");
        expect(new Date(created.ends_at).toISOString().slice(0, 10)).toBe("2026-10-07");
        expect(created.challenge_rules_json).toEqual({ minShots: 3, clubTypes: ["driver"] });
        expect(
          await db`select id from fkh_challenge_invites where challenge_id=${id}`,
        ).toHaveLength(0);
      }
    expect(errors).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    if (templateId) await db`delete from fkh_challenge_templates where id=${templateId}`;
    await db.end();
  }
});
