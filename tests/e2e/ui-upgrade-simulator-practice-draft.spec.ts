import { expect, test } from "@playwright/test";
import postgres from "postgres";
test("Simulator prescriptions persist exact drafts and owned evidence on both surfaces", async ({
  page,
  context,
}, info) => {
  const value = process.env.DATABASE_URL;
  const target = value ? new URL(value) : null;
  test.skip(
    info.project.name !== "chromium" ||
      process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      target?.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
  );
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  try {
    owner = (await db`insert into fkh_users(name) values('Synthetic Lab browser') returning id`)[0]
      .id;
    const session = (
      await db`insert into fkh_sessions(user_id,source,type,date,raw_csv_text) values(${owner!},'manual','range',now(),'Synthetic Lab fixture') returning id`
    )[0].id;
    for (const type of ["7i", "driver"]) {
      const club = (
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner!},${type},${type}) returning id`
      )[0].id;
      await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_at,carry_yd,total_yd,side_carry_yd,review_status,source_raw_json) select ${owner!},${session},${club},${type},now(),150+n*3,160+n*3,n*5,'included','{}' from generate_series(1,4)n`;
    }
    const original =
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`;
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "synthetic-lab@example.invalid" }),
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
    for (const surface of ["workbench", "companion"]) {
      await context.addCookies([
        { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
      ]);
      for (const [index, viewport] of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
        { width: 360, height: 800 },
        { width: 1023, height: 800 },
        { width: 1024, height: 800 },
      ]
        .filter(
          (size) =>
            process.env.SIMULATOR_CONFIDENCE_ONLY !== "1" || [1440, 390].includes(size.width),
        )
        .entries()) {
        await page.setViewportSize(viewport);
        await page.goto("/simulator-lab");
        await expect(page.getByLabel("Monthly confidence values")).toContainText(
          "8 shots used · 1 session · 8 usable shots available",
        );
        await expect(page.getByLabel("Monthly confidence values")).toContainText(
          "No supported estimate",
        );
        const prescriptionId = ["primary-club", "secondary-club", "transfer"][index % 3];
        const form = page
          .locator("form")
          .filter({ has: page.locator(`input[name="prescriptionId"][value="${prescriptionId}"]`) });
        const id = await form.locator('input[name="creationId"]').inputValue();
        const drill = await form.locator("..").locator("p").nth(2).innerText();
        await form
          .getByRole("button", { name: "Save this drill as a practice draft", exact: true })
          .click();
        await expect(page).toHaveURL(new RegExp(`/practice\\?planId=${id}`));
        const source = page.getByRole("complementary", { name: "Simulator practice source" });
        await expect(source).toContainText("8 usable range shots");
        await expect(source).toContainText("completion does not prove improvement");
        const saved = (
          await db`select status,started_at,facility_json from fkh_practice_plans where id=${id} and user_id=${owner!}`
        )[0];
        expect(saved.status).toBe("planned");
        expect(saved.started_at).toBeNull();
        expect(saved.facility_json.generation.prescriptionConfidence).toBe("Low");
        expect(saved.facility_json.generation.simulatorHandoff.prescriptionId).toBe(prescriptionId);
        expect(saved.facility_json.generation.simulatorHandoff.sessionIds).toEqual([session]);
        const block = (
          await db`select drill,scoring_rules_json from fkh_practice_blocks where practice_plan_id=${id}`
        )[0];
        expect(block.drill).toBe(drill);
        expect(block.scoring_rules_json.evidenceMode).toBe("manual");
        await expect(page.getByText(drill, { exact: true }).last()).toBeVisible();
        await page.reload();
        await expect(source).toBeVisible();
        await expect(page.getByText(/Low (plan )?confidence/).first()).toBeVisible();
        await source.locator("summary").click();
        await expect(source.getByRole("link", { name: "Open source session 1" })).toHaveAttribute(
          "href",
          `/sessions/${session}`,
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({
          path: info.outputPath(`P29-practice-${surface}-${viewport.width}.png`),
          animations: "disabled",
        });
      }
    }
    expect(errors).toEqual([]);
    expect(
      await db`select id,carry_yd,total_yd,side_carry_yd,review_status from fkh_shots where user_id=${owner!} order by id`,
    ).toEqual(original);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
