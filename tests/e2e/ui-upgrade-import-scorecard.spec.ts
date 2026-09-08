import { expect, test } from "@playwright/test";
import postgres from "postgres";
const check = expect.configure({ timeout: 60000 });
test("P35 scorecard import review survives pending, failure, retry and replacement on both surfaces", async ({
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
    "Designated isolated fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(300000);
  const db = postgres(value!, { max: 1 });
  let owner: string | undefined;
  let mode: "complete" | "hold" | "failure" | "partial" = "complete";
  let release: () => void = () => {};
  let started: () => void = () => {};
  let finished: () => void = () => {};
  let gate = Promise.resolve();
  const requests: unknown[] = [];
  const scorecard = (name: string, yards: number | null) => ({
    courseName: name,
    dateIso: "2026-09-01",
    holes: [
      {
        holeNumber: 1,
        par: 4,
        yards,
        score: 2,
        putts: 0,
        netScore: null,
        fairwayHit: null,
        gir: null,
        strokeIndex: 1,
      },
    ],
    teeName: null,
    totalYards: yards,
    courseRating: null,
    slopeRating: null,
    totalScore: 2,
    totalPutts: 0,
    fairwaysHitTotal: null,
    girTotal: null,
  });
  try {
    owner = (
      await db`insert into fkh_users(name) values('P35 OCR isolated fixture') returning id`
    )[0].id;
    const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: owner, email: "ocr@forekinghell.local" }),
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
    // Every extraction is intercepted: this suite never reaches a paid provider.
    await page.route("**/api/scorecard/extract", async (route) => {
      requests.push(route.request().postDataJSON());
      const responseMode = mode;
      if (responseMode === "hold") {
        started();
        await gate;
      }
      try {
        await route.fulfill(
          responseMode === "failure"
            ? { status: 503, json: { message: "Synthetic extraction failure. Retry your image." } }
            : {
                json: {
                  scorecard: scorecard(
                    responseMode === "hold"
                      ? "Delayed extraction course"
                      : responseMode === "partial"
                        ? "New course without yardages"
                        : "Synthetic reviewed course",
                    responseMode === "partial" ? null : 350,
                  ),
                },
              },
        );
      } catch {
        /* Aborted browser requests cannot consume the response. */
      } finally {
        if (responseMode === "hold") finished();
      }
    });
    const uploadImage = async (form: ReturnType<typeof page.locator>) =>
      form.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({
        name: "synthetic-scorecard.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    for (const surface of ["workbench", "companion"]) {
      await page.goto(`/surface/${surface}?next=${encodeURIComponent("/import?source=csv")}`);
      if (surface === "companion")
        await page.getByRole("button", { name: "Full import workflow", exact: true }).click();
      const form = page.locator('[data-import-ready="true"]');
      await check(form).toBeVisible();
      await form
        .locator('input[type="file"]')
        .first()
        .setInputFiles({
          name: "synthetic-round.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            "Shot Number,Club,Carry Distance,Total Distance,Ball Speed,Launch Angle,Side Carry\n1,7 Iron,150,160,110,18,1\n2,7 Iron,152,162,111,19,2",
          ),
        });
      await check(form.locator("[data-import-shot-preview]")).toContainText("2 parsed shots");
      await form.getByRole("button", { name: /Session type/ }).click();
      await page.getByRole("option", { name: "Simulated course", exact: true }).click();
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        mode = "complete";
        await uploadImage(form);
        await check(form.getByLabel("Course name", { exact: true })).toHaveValue(
          "Synthetic reviewed course",
        );
        const reviewed = form.getByRole("checkbox", {
          name: /I have checked the extracted scorecard/,
        });
        const save = form.getByRole("button", { name: "Save import", exact: true });
        await check(reviewed).not.toBeChecked();
        await check(save).toBeDisabled();
        await form.getByRole("button", { name: "Confirm settings", exact: true }).click();
        const warnings = form.getByRole("checkbox", { name: /I have reviewed these warnings/ });
        if (await warnings.count()) await warnings.check();
        await reviewed.check();
        await check(save).toBeEnabled();
        mode = "hold";
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const begun = new Promise<void>((resolve) => {
          started = resolve;
        });
        const ended = new Promise<void>((resolve) => {
          finished = resolve;
        });
        await uploadImage(form);
        await begun;
        await check(save).toBeDisabled();
        await check(reviewed).toBeDisabled();
        await form.getByRole("button", { name: "Cancel extraction", exact: true }).click();
        release();
        await ended;
        await check(form.getByLabel("Course name", { exact: true })).toHaveValue(
          "Synthetic reviewed course",
        );
        await check(reviewed).not.toBeChecked();
        await check(save).toBeDisabled();
        mode = "failure";
        await uploadImage(form);
        await check(
          form.getByText("Synthetic extraction failure. Retry your image.", { exact: true }),
        ).toBeVisible();
        await check(reviewed).not.toBeChecked();
        await check(save).toBeDisabled();
        mode = "partial";
        await uploadImage(form);
        await check(form.getByLabel("Course name", { exact: true })).toHaveValue(
          "New course without yardages",
        );
        const rows = form.locator("#scorecard");
        await check(rows).toHaveValue("");
        await check(reviewed).not.toBeChecked();
        await check(save).toBeDisabled();
        await rows.fill("1,4,355");
        await form.getByRole("button", { name: "Confirm settings", exact: true }).click();
        if (await warnings.count()) await warnings.check();
        await reviewed.check();
        await check(save).toBeEnabled();
        await form.getByLabel("Course name", { exact: true }).fill("Reviewed replacement course");
        await check(reviewed).not.toBeChecked();
        await check(save).toBeDisabled();
        await reviewed.check();
        await rows.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`P35-OCR-${surface}-${width}.png`) });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        ).toBe(true);
      }
      // Confirming settings while an image is pending cannot confirm its new date.
      mode = "hold";
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const begun = new Promise<void>((resolve) => {
        started = resolve;
      });
      const ended = new Promise<void>((resolve) => {
        finished = resolve;
      });
      await uploadImage(form);
      await begun;
      await form.getByRole("button", { name: "Confirm settings", exact: true }).click();
      release();
      await ended;
      await check(form.getByLabel("Course name", { exact: true })).toHaveValue(
        "Delayed extraction course",
      );
      await check(
        form.getByRole("button", { name: "Confirm settings", exact: true }),
      ).toBeVisible();
      await check(form.getByRole("button", { name: "Save import", exact: true })).toBeDisabled();
    }
    expect(requests.length).toBe(50);
    for (const request of requests)
      expect(request).toMatchObject({
        purpose: "import_review",
        imageDataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      });
    expect(await db`select id from fkh_sessions where user_id=${owner!}`).toHaveLength(0);
  } finally {
    release();
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
