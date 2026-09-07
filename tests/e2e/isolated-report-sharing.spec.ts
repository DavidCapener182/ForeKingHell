import { expect, test } from "@playwright/test";
import postgres from "postgres";

test.use({ actionTimeout: 15000 });

test("fresh owner creates, password-unlocks and revokes a report", async ({
  page,
  context,
  browser,
}) => {
  const url = process.env.DATABASE_URL;
  const target = url ? new URL(url) : null;
  test.skip(
    process.env.RUN_REDESIGN_DB_TESTS !== "1" ||
      !target ||
      target.hostname !== "127.0.0.1" ||
      target.port !== "55432" ||
      target.pathname !== "/fkh_redesign" ||
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116",
    "Requires designated disposable environment",
  );
  test.setTimeout(90000);
  const sql = postgres(url!, { max: 1 });
  let userId: string | undefined;
  const visitor = await browser.newContext({
    baseURL: "http://localhost:3116",
    storageState: { cookies: [], origins: [] },
  });
  try {
    userId = (
      await sql`insert into fkh_users(name) values('Synthetic report browser owner') returning id`
    )[0].id;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = [
      encode({ alg: "none" }),
      encode({ sub: userId, email: "synthetic-report@forekinghell.local" }),
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
    await page.goto("/surface/workbench?next=%2Fcoach%2Freports");
    await page.getByLabel("Report title (optional)").fill("Synthetic protected report");
    await page.getByRole("button", { name: "Continue to privacy", exact: true }).click();
    await page.getByLabel("Optional password", { exact: true }).fill("Synthetic password 123");
    await page.getByRole("button", { name: "Review report", exact: true }).click();
    await page.getByRole("button", { name: "Create frozen report link", exact: true }).click();
    await expect(page).toHaveURL(/share=/);
    const shareToken = new URL(page.url()).searchParams.get("share")!;
    expect(await sql`select id from fkh_share_links where user_id=${userId!}`).toHaveLength(1);
    const shared = await visitor.newPage();
    await shared.goto(`/share/report/${shareToken}`);
    await expect(shared.getByLabel("Password", { exact: true })).toBeVisible();
    await shared.getByLabel("Password", { exact: true }).fill("Wrong password 123");
    await shared.getByRole("button", { name: "Open report", exact: true }).click();
    await expect(shared.getByText("That password did not match.", { exact: true })).toBeVisible();
    await shared.getByLabel("Password", { exact: true }).fill("Synthetic password 123");
    await shared.getByRole("button", { name: "Open report", exact: true }).click();
    await expect(
      shared.getByRole("heading", { name: "Synthetic protected report", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Report details and actions", exact: true }).click();
    await page.getByRole("button", { name: "Revoke report link", exact: true }).click();
    await page.getByRole("button", { name: "Confirm revocation", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await sql`select revoked_at from fkh_share_links where user_id=${userId!}`)[0]
            .revoked_at,
      )
      .not.toBeNull();
    await shared.reload();
    await expect(shared.getByText("Page not found", { exact: true })).toBeVisible();
    await expect(
      shared.getByRole("heading", { name: "Synthetic protected report", exact: true }),
    ).toHaveCount(0);
  } finally {
    await visitor.close();
    if (userId) await sql`delete from fkh_users where id=${userId}`;
    await sql.end();
  }
});
