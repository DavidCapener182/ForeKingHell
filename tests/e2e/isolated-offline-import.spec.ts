import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

test.use({ actionTimeout: 15000 });

test("fresh account imports through HTTP, replays, and opens its session", async ({
  page,
  context,
}, info) => {
  const url = process.env.DATABASE_URL;
  const target = url ? new URL(url) : null;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      !target ||
      target.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
    "Requires the designated disposable server and database",
  );
  test.setTimeout(120000);
  const sql = postgres(url!, { max: 1 });
  let userId: string | undefined;
  try {
    userId = (
      await sql`insert into fkh_users(name) values('Synthetic browser import') returning id`
    )[0].id;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: userId, email: "synthetic-browser@forekinghell.local" }),
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
    const rawCsvText =
      "Shot Number,Club,Carry Distance,Total Distance,Ball Speed\n1,7 Iron,150,160,110\n2,7 Iron,152,162,111";
    const data = {
      inputs: [
        {
          rawCsvText,
          fileName: `synthetic-browser-${userId!}.csv`,
          fileSizeBytes: rawCsvText.length,
          source: "rapsodo",
          sessionType: "range",
          sessionDate: "2026-09-01",
          distanceUnit: "yards",
        },
      ],
    };
    const headers = {
      "x-fkh-offline-owner": userId!,
      "x-fkh-offline-operation": crypto.randomUUID(),
    };
    const first = await context.request.post("/api/offline/imports", { data, headers });
    expect(first.status(), await first.text()).toBe(200);
    const body = await first.json();
    expect(body.ok).toBe(true);
    const replay = await context.request.post("/api/offline/imports", { data, headers });
    expect(replay.headers()["x-fkh-offline-replayed"]).toBe("1");
    expect(await replay.json()).toEqual(body);
    expect(await sql`select id from fkh_sessions where user_id=${userId!}`).toHaveLength(1);
    expect(await sql`select id from fkh_shots where user_id=${userId!}`).toHaveLength(2);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `/surface/workbench?next=${encodeURIComponent(`/sessions/${body.savedSessionId}`)}`,
    );
    await expect(page).toHaveURL(new RegExp(`/sessions/${body.savedSessionId}`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(data.inputs[0].fileName, { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Loading this session’s shot evidence…", { exact: true }),
    ).toBeHidden({ timeout: 30000 });
    await page.screenshot({ path: info.outputPath("imported-session.png"), fullPage: true });
    await page.getByRole("link", { name: "Next practice", exact: true }).click();
    await expect(page.locator("[data-practice-source-session]")).toHaveAttribute(
      "data-practice-source-session",
      body.savedSessionId,
    );
    await page.getByRole("button", { name: "Save only", exact: true }).click();
    const workspace = page.locator("[data-practice-training-workspace]");
    await expect(workspace).toHaveAttribute("data-practice-plan-id", /[0-9a-f-]{36}/);
    const planId = await workspace.getAttribute("data-practice-plan-id");
    const [savedPlan] =
      await sql`select context_json from fkh_practice_plans where id=${planId!} and user_id=${userId!}`;
    expect(savedPlan.context_json.latestPractice.sessionId).toBe(body.savedSessionId);
    await page.goto(`/practice?planId=${planId}`);
    await expect(page.locator("[data-practice-source-session]")).toHaveAttribute(
      "data-practice-source-session",
      body.savedSessionId,
    );
    await expect(page.locator("[data-practice-training-workspace]")).toHaveAttribute(
      "data-practice-plan-id",
      planId!,
    );
    await page.getByRole("link", { name: "Open guided session", exact: true }).click();
    await page.getByRole("button", { name: "Start saved practice", exact: true }).click();
    const active = page.locator("[data-active-range-mode]");
    await expect(active).toBeVisible();
    await expect(active).toHaveAttribute("data-practice-plan-id", planId!);
    await page.getByRole("button", { name: "Session options", exact: true }).click();
    await page.getByRole("button", { name: "Pause session", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Resume Range Mode", exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Resume Range Mode", exact: true }).click();
    await expect(active).toBeVisible();
    expect(await sql`select id from fkh_practice_plans where user_id=${userId!}`).toHaveLength(1);
    await page.getByRole("button", { name: "Session options", exact: true }).click();
    await page.getByRole("button", { name: "Finish practice", exact: true }).click();
    await page.getByRole("button", { name: "Finish without evidence", exact: true }).click();
    await page.getByRole("button", { name: "Finish activity only", exact: true }).click();
    await expect
      .poll(
        async () =>
          (
            await sql`select status from fkh_practice_plans where id=${planId!} and user_id=${userId!}`
          )[0].status,
      )
      .toBe("completed");
    expect(
      await sql`select id from fkh_practice_results where practice_plan_id=${planId!} and user_id=${userId!}`,
    ).toHaveLength(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Activity completed", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Import measured session", exact: true }),
    ).toHaveAttribute("href", `/import?practicePlanId=${planId}`);
    const measuredData = {
      inputs: [
        {
          ...data.inputs[0],
          practicePlanId: planId!,
          sessionDate: new Date().toISOString(),
          fileName: `measured-${userId!}.csv`,
          rawCsvText: rawCsvText
            .replace("150,160,110", "155,165,112")
            .replace("152,162,111", "157,167,113"),
        },
      ],
    };
    const measuredHeaders = { ...headers, "x-fkh-offline-operation": crypto.randomUUID() };
    const measured = await context.request.post("/api/offline/imports", {
      data: measuredData,
      headers: measuredHeaders,
    });
    expect(measured.status(), await measured.text()).toBe(200);
    const measuredBody = await measured.json();
    expect(measuredBody.savedSessionId).not.toBe(body.savedSessionId);
    expect(
      await sql`select id from fkh_practice_results where practice_plan_id=${planId!} and user_id=${userId!}`,
    ).toHaveLength(1);
    const measuredReplay = await context.request.post("/api/offline/imports", {
      data: measuredData,
      headers: measuredHeaders,
    });
    expect(await measuredReplay.json()).toEqual(measuredBody);
    expect(
      await sql`select id from fkh_practice_results where practice_plan_id=${planId!} and user_id=${userId!}`,
    ).toHaveLength(1);
    const [measuredResult] =
      await sql`select source_session_id from fkh_practice_results where practice_plan_id=${planId!} and user_id=${userId!}`;
    expect(measuredResult.source_session_id).toBe(measuredBody.savedSessionId);
    await page.reload();
    await expect(page.locator("[data-plan-versus-actual]")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Measured practice sources" }).getByRole("link").first(),
    ).toHaveAttribute("href", `/sessions/${measuredBody.savedSessionId}`);
    const xp =
      await sql`select amount,reason,achievement_id,metadata_json from fkh_xp_ledger where user_id=${userId!} order by amount desc`;
    await writeFile(info.outputPath("synthetic-xp-ledger.json"), JSON.stringify(xp, null, 2));
    await info.attach("synthetic-xp-ledger", {
      body: JSON.stringify(xp, null, 2),
      contentType: "application/json",
    });
    expect(errors).toEqual([]);
  } finally {
    if (userId) await sql`delete from fkh_users where id=${userId!}`;
    await sql.end();
  }
});
