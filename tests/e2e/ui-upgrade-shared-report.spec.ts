import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { randomUUID, createHash } from "node:crypto";
import { hashReportPassword } from "../../src/lib/coach-report-access";
test("Frozen shared report preserves password retry and all selected evidence", async ({
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
      process.env.PLAYWRIGHT_BASE_URL !== "http://localhost:3116" ||
      info.project.name !== "chromium",
  );
  test.setTimeout(300000);
  const db = postgres(value!, { max: 1 });
  let owner = "";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    owner = (
      await db`insert into fkh_users(name) values('Synthetic frozen report owner') returning id`
    )[0].id;
    const snapshot = {
      schemaVersion: 1,
      generatedAt: "2026-09-01T10:00:00.000Z",
      title: "Synthetic frozen selected evidence",
      sections: {
        bagNumbers: [
          {
            club: "7 Iron",
            stockCarryYd: 154,
            playableRate: 70,
            sampleSize: 23,
            confidence: "High",
          },
        ],
        rawEvidence: [
          {
            sessionId: "synthetic-session",
            sessionDate: "2026-09-01",
            club: "7 Iron",
            shotNumber: 1,
            carryYd: 154,
            sideCarryYd: -3,
            ballSpeedMph: 112,
            launchAngleDeg: 19,
            quality: "Measured fixture evidence",
          },
        ],
      },
      disclosure: {
        selectedSections: ["bag_numbers", "raw_evidence"],
        omittedSections: ["notes"],
        statement: "Only the selected synthetic evidence is included.",
      },
    };
    const exportId = (
      await db`insert into fkh_content_exports(user_id,source_type,source_id,snapshot_json,render_config_json) values(${owner},'coach_report','synthetic',${db.json(snapshot)},${db.json({ passwordHash: hashReportPassword("Synthetic password 123"), disableDownload: true })}) returning id`
    )[0].id;
    const token = randomUUID();
    const hash = createHash("sha256").update(token).digest("hex");
    const link = (
      await db`insert into fkh_share_links(user_id,token_hash,resource_type,resource_id) values(${owner},${hash},'coach_report',${exportId}) returning id`
    )[0].id;
    for (const surface of ["workbench", "companion"]) {
      for (const [width, height] of [
        [1440, 900],
        [1280, 800],
        [390, 844],
        [360, 800],
        [1023, 800],
        [1024, 800],
      ]) {
        await context.clearCookies();
        await context.addCookies([
          { name: "fkh-app-surface", value: surface, domain: "localhost", path: "/" },
        ]);
        await page.setViewportSize({ width, height });
        await page.goto(`/share/report/${token}`, {
          waitUntil: "domcontentloaded",
          timeout: 90000,
        });
        await expect(page.getByRole("button", { name: "Open report", exact: true })).toBeEnabled({
          timeout: 60000,
        });
        await expect(page.getByRole("heading", { name: snapshot.title, exact: true })).toHaveCount(
          0,
        );
        await page.getByLabel("Password", { exact: true }).fill("Wrong password 123");
        await page.getByRole("button", { name: "Open report", exact: true }).click();
        await expect(page.locator("#shared-report-password-error")).toContainText(
          "That password did not unlock this report",
        );
        await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
          "Wrong password 123",
        );
        await page.getByRole("button", { name: "Show password", exact: true }).click();
        await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
        await page.screenshot({ path: info.outputPath(`P90-gate-${surface}-${width}.png`) });
        await page.getByLabel("Password", { exact: true }).fill("Synthetic password 123");
        await page.getByRole("button", { name: "Open report", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: snapshot.title, level: 1, exact: true }),
        ).toBeVisible({ timeout: 60000 });
        await expect(page.getByRole("heading", { name: "Bag numbers", exact: true })).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Selected raw evidence", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("cell", { name: "Measured fixture evidence", exact: true }),
        ).toBeAttached();
        await expect(page.getByRole("heading", { name: "Golfer notes", exact: true })).toHaveCount(
          0,
        );
        await expect(page.getByText(/Later account changes do not update/)).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: info.outputPath(`P90-report-${surface}-${width}.png`) });
      }
    }
    await db`update fkh_share_links set revoked_at=now() where id=${link}`;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Shared report unavailable", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: snapshot.title, exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (owner) await db`delete from fkh_users where id=${owner}`;
    await db.end();
  }
});
