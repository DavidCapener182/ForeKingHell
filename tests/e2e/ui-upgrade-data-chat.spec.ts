import { expect, test } from "@playwright/test";
import postgres from "postgres";

test("Data Chat supports retry, all citations and owner-scoped saved answers on both surfaces", async ({
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
    "Designated disposable fixture only",
  );
  test.skip(info.project.name !== "chromium");
  test.setTimeout(180000);
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(60000);
  const db = postgres(value!, { max: 1 });
  const ids: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let requests = 0;
  let fail = true;
  try {
    const people =
      await db`insert into fkh_users(name) values('UI chat paid'),('UI chat free') returning id`;
    ids.push(...people.map((person) => person.id));
    await db`insert into fkh_subscriptions(user_id,plan_key,status) values(${ids[0]},'pro','active')`;
    const [session] =
      await db`insert into fkh_sessions(user_id,source,type,date,file_name,raw_csv_text) values(${ids[0]},'manual','range','2026-09-01','Chat synthetic source','synthetic') returning id`;
    async function login(id: string) {
      const encode = (item: unknown) => Buffer.from(JSON.stringify(item)).toString("base64url");
      const token = [
        encode({ alg: "none" }),
        encode({ sub: id, email: "ui-chat@forekinghell.local" }),
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
    }
    await page.route("**/api/ai/data-chat", async (route) => {
      requests++;
      await route.fulfill({
        status: fail ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          fail
            ? { message: "Synthetic service unavailable; retry your question." }
            : {
                answer:
                  "Synthetic answer: compare your recorded carry before changing your practice target.",
                tips: [],
                drills: [],
                followUpQuestions: [],
                confidence: "medium",
                citations: Array.from({ length: 8 }, (_, index) => ({
                  id: `fixture-${index}`,
                  label: `Synthetic source ${index + 1}`,
                  detail: `Owned fixture record ${index + 1}; no live AI call.`,
                  href: `/sessions/${session.id}`,
                })),
                generatedAt: "2026-09-07T00:00:00Z",
                creditsCharged: 0,
                creditsRemaining: 100,
              },
        ),
      });
    });
    await login(ids[0]);
    for (const surface of ["workbench", "companion"]) {
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(`/surface/${surface}?next=/data-chat`);
        await expect(page.locator('[data-data-chat-ready="true"]')).toBeVisible({ timeout: 60000 });
        const input = page.getByRole("textbox", { name: "Ask about your golf data", exact: true });
        const question = `Compare my carry ${surface} ${width}`;
        await input.fill(question);
        fail = true;
        await page.getByRole("button", { name: "Ask analyst", exact: true }).click();
        await expect(
          page.getByText("Synthetic service unavailable; retry your question.", { exact: true }),
        ).toBeVisible();
        await expect(input).toHaveValue(question);
        fail = false;
        await page.getByRole("button", { name: "Ask analyst", exact: true }).click();
        await expect(page.locator('[data-chat-role="assistant"]')).toContainText(
          "Synthetic answer:",
        );
        const citation = page.getByRole("button", {
          name: "Open evidence: Synthetic source 8",
          exact: true,
        });
        await citation.click();
        if (width < 1024) {
          await expect(page.getByRole("dialog")).toContainText("Owned fixture record 8");
          await page.getByRole("button", { name: "Close evidence", exact: true }).click();
        } else {
          await expect(
            page.getByText("Owned fixture record 8; no live AI call.", { exact: true }).first(),
          ).toBeVisible();
        }
        await page.getByRole("button", { name: "Save", exact: true }).click();
        const countBeforeOpen = requests;
        await page.getByRole("button", { name: /^Saved answers,/ }).click();
        await page.getByRole("button", { name: "Open saved answer", exact: true }).first().click();
        await expect(page.locator('[data-chat-role="assistant"]')).toContainText(
          "Synthetic answer:",
        );
        expect(requests).toBe(countBeforeOpen);
        await expect(page.locator("h1")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        ).toBe(false);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ animations: "disabled", path: info.outputPath(`P21-${surface}-${width}.png`) });
      }
    }
    await login(ids[1]);
    await page.goto("/data-chat");
    await expect(page.getByText("Pro access required", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Ask about your golf data" })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (ids.length) await db`delete from fkh_users where id in ${db(ids)}`;
    await db.end();
  }
});
