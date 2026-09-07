import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("Public Today keeps owned evidence, surface, query and history across viewport boundaries", async ({
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
  page.setDefaultNavigationTimeout(90000);
  const db = postgres(value!, { max: 1 });
  const owners: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const date = new Date().toISOString().slice(0, 10);
    const records: Array<{ owner: string; session: string; shots: string[] }> = [];
    for (const label of ["Owned Today isolate", "Foreign Today isolate"]) {
      const [owner] = await db`insert into fkh_users(name) values(${label}) returning id`;
      owners.push(owner.id);
      const [session] =
        await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${owner.id},'rapsodo','range',${date},${label},'synthetic') returning id`;
      const [club] =
        await db`insert into fkh_clubs(user_id,type,normalized_club_key) values(${owner.id},'7i',${label}) returning id`;
      const shots =
        await db`insert into fkh_shots(user_id,session_id,club_id,club_type,shot_number,carry_yd,total_yd,side_carry_yd,apex_ft,quality_tag,shot_category,review_status,shot_at,source_raw_json) select ${owner.id},${session.id},${club.id},'7i',n,150+n,160+n,n-3,70,'good','stock','included',${date}::timestamp,'{}'::jsonb from generate_series(1,6) n returning id`;
      records.push({ owner: owner.id, session: session.id, shots: shots.map((s) => s.id) });
    }
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: records[0].owner, email: "today-isolate@forekinghell.local" }),
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
    const next = `/today?tab=overview&date=${date}&session=${records[0].session}&check=retained`;
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=${encodeURIComponent(next)}`);
      await expect(page.locator("[data-today-workspace-tabs]")).toHaveAttribute(
        "data-ready",
        "true",
        { timeout: 90000 },
      );
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        expect(new URL(page.url()).pathname).toBe("/today");
        expect(new URL(page.url()).searchParams.get("session")).toBe(records[0].session);
        expect(new URL(page.url()).searchParams.get("check")).toBe("retained");
        const tabs = page.locator("[data-today-workspace-tabs]");
        await tabs.getByRole("tab", { name: "Evidence", exact: true }).click();
        await expect(tabs.getByRole("tabpanel")).toHaveAccessibleName("Evidence");
        await tabs.getByRole("tab", { name: "Data quality", exact: true }).click();
        await page.goBack();
        await expect(tabs.getByRole("tab", { name: "Evidence", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await page.goForward();
        await expect(tabs.getByRole("tab", { name: "Data quality", exact: true })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        expect(new URL(page.url()).searchParams.get("check")).toBe("retained");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBeTruthy();
        if (surface === "workbench") {
          const points = await page
            .locator("[data-today-shot-point]")
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-today-shot-point")));
          expect(points.length).toBeGreaterThan(0);
          expect(points.every((id) => id !== null && records[0].shots.includes(id))).toBeTruthy();
        }
        await page.screenshot({
          path: info.outputPath(`today-isolation-${surface}-${width}.png`),
          animations: "disabled",
        });
      }
      await page.reload();
      await expect(page.locator("[data-today-workspace-tabs]")).toHaveAttribute(
        "data-ready",
        "true",
      );
      expect(new URL(page.url()).pathname).toBe("/today");
      const foreign = await page.request.get(`/api/shots/${records[1].shots[0]}/evidence`);
      expect([403, 404]).toContain(foreign.status());
      const owned = await page.request.get(`/api/shots/${records[0].shots[0]}/evidence`);
      expect(owned.ok()).toBeTruthy();
      expect((await owned.json()).shot.id).toBe(records[0].shots[0]);
    }
    expect(errors).toEqual([]);
    expect(await db`select id from fkh_shots where user_id=${records[0].owner}`).toHaveLength(6);
  } finally {
    for (const id of owners) await db`delete from fkh_users where id=${id}`;
    await db.end();
  }
});
