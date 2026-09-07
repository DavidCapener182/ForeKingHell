import { expect, test } from "@playwright/test";
import postgres from "postgres";

test.use({ actionTimeout: 15000 });

for (const surface of ["companion"] as const) {
  test(`offline upload replays through a real service worker message`, async ({
    page,
    context,
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
      // Isolate worker-triggered replay from the ordinary online-event retry.
      await page.addInitScript(() =>
        window.addEventListener("online", (event) => event.stopImmediatePropagation(), true),
      );
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
      await context.setOffline(false);
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Worker activation timeout: installing=${registration.installing?.state}; waiting=${registration.waiting?.state}; active=${registration.active?.state}`,
                  ),
                ),
              15000,
            ),
          ),
        ]);
      });
      await expect
        .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
        .toBe(true);
      const worker = context.serviceWorkers().find((worker) => worker.url().endsWith("/sw.js"));
      expect(worker).toBeDefined();
      // Execute the real handler; this does not claim browser/OS sync scheduling.
      await worker!.evaluate(async () => {
        const work: Promise<unknown>[] = [];
        const event = Object.assign(new Event("sync"), {
          tag: "forekinghell-offline-sync",
          waitUntil: (promise: Promise<unknown>) => work.push(promise),
        });
        self.dispatchEvent(event);
        await Promise.all(work);
      });
      await expect
        .poll(
          async () => (await sql`select id from fkh_sessions where user_id=${userId!}`).length,
          { timeout: 60000 },
        )
        .toBe(1);
      const [saved] = await sql`select raw_csv_text from fkh_sessions where user_id=${userId!}`;
      expect(saved.raw_csv_text).toBe(csv);
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

      expect(await sql`select id from fkh_shots where user_id=${userId!}`).toHaveLength(2);
    } finally {
      await context.setOffline(false);
      if (userId) await sql`delete from fkh_users where id=${userId!}`;
      await sql.end();
    }
  });
}
