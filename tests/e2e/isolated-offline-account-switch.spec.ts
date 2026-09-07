import { expect, test } from "@playwright/test";
import postgres from "postgres";

test.use({ actionTimeout: 15000 });

for (const surface of ["companion"] as const) {
  test(`offline upload never crosses accounts after sign-in changes`, async ({ page, context }) => {
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
    let secondUserId: string | undefined;

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
      const fileName = `picker-${userId!}.csv`;
      const csv =
        "Shot Number,Club,Carry Distance,Total Distance,Ball Speed\n1,7 Iron,151,161,111\n2,7 Iron,153,163,112";
      await page.setViewportSize(
        surface === "companion" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      );
      await page.goto(`/surface/${surface}?next=%2Fimport%3Fsource%3Dcsv`);
      await page
        .locator("#companion-csv-file")
        .setInputFiles({ name: fileName, mimeType: "text/csv", buffer: Buffer.from(csv) });
      const confirmation = page.locator("[data-companion-csv-confirmation]");
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByText("New session", { exact: true })).toBeVisible({
        timeout: 60000,
      });
      await page.evaluate(() =>
        localStorage.setItem("forekinghell:offline-import-retention-days", "1"),
      );
      await context.setOffline(true);
      await confirmation
        .getByRole("button", { name: "Save and build review", exact: true })
        .click();
      await expect(
        page.getByText("Queued on this phone. Analysis will appear after the upload syncs.", {
          exact: true,
        }),
      ).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByText("Upload queued on this device", { exact: true })).toBeVisible();
      await expect(page.getByText("This file cannot be imported", { exact: true })).toHaveCount(0);
      const queued = await page.evaluate(
        () =>
          new Promise<{ ownerUserId: string; payload: unknown }[]>((resolve, reject) => {
            const request = indexedDB.open("forekinghell-offline", 2);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const read = db
                .transaction("pending-actions", "readonly")
                .objectStore("pending-actions")
                .getAll();
              read.onsuccess = () => {
                resolve(read.result);
                db.close();
              };
              read.onerror = () => {
                reject(read.error);
                db.close();
              };
            };
          }),
      );
      expect(queued).toHaveLength(1);
      expect(queued[0].ownerUserId).toBe(userId);
      expect(await sql`select id from fkh_sessions where user_id=${userId!}`).toHaveLength(0);
      secondUserId = (
        await sql`insert into fkh_users(name) values('Synthetic second account') returning id`
      )[0].id;
      const secondToken = [
        encode({ alg: "none" }),
        encode({ sub: secondUserId, email: "synthetic-second@forekinghell.local" }),
        "playwright",
      ].join(".");
      await context.addCookies([
        {
          name: "sb-playwright-auth-token",
          value: encodeURIComponent(JSON.stringify({ access_token: secondToken })),
          domain: "localhost",
          path: "/",
        },
      ]);
      // Reconnect while the previous account's page is still mounted. The server
      // must reject any stale replay; the new account then purges foreign local data.
      await context.setOffline(false);
      const denied = await context.request.post("/api/offline/imports", {
        headers: {
          "x-fkh-offline-owner": userId!,
          "x-fkh-offline-operation": `account-switch-${userId}`,
        },
        data: queued[0].payload,
      });
      expect(denied.status()).toBe(409);
      await page.goto("/surface/companion?next=%2Fimport%3Fsource%3Dcsv");
      await expect(page.locator("html")).toHaveAttribute("data-offline-account-id", secondUserId!);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              new Promise<number>((resolve, reject) => {
                const request = indexedDB.open("forekinghell-offline", 2);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                  const db = request.result;
                  const read = db
                    .transaction("pending-actions", "readonly")
                    .objectStore("pending-actions")
                    .count();
                  read.onsuccess = () => {
                    resolve(read.result);
                    db.close();
                  };
                  read.onerror = () => {
                    reject(read.error);
                    db.close();
                  };
                };
              }),
          ),
        )
        .toBe(0);

      expect(
        await sql`select id from fkh_sessions where user_id in (${userId!}, ${secondUserId!})`,
      ).toHaveLength(0);
      expect(
        await sql`select id from fkh_shots where user_id in (${userId!}, ${secondUserId!})`,
      ).toHaveLength(0);
    } finally {
      await context.setOffline(false);
      if (userId) await sql`delete from fkh_users where id=${userId!}`;
      if (secondUserId) await sql`delete from fkh_users where id=${secondUserId!}`;
      await sql.end();
    }
  });
}
