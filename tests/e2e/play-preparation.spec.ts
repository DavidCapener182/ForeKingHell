import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { hasLocalAuthBypass } from "./helpers";

test("Play preserves the selected tee and hole through strategy, reload and round preparation", async ({
  page,
}, testInfo) => {
  const databaseUrl = process.env.DATABASE_URL;
  const target = databaseUrl ? new URL(databaseUrl) : null;
  test.skip(
    !hasLocalAuthBypass ||
      !target ||
      !["localhost", "127.0.0.1"].includes(target.hostname) ||
      target.pathname !== "/fkh_redesign",
    "Requires isolated redesign data.",
  );
  test.setTimeout(120_000);
  const sql = postgres(databaseUrl!, { max: 1 });
  try {
    const [tee] = await sql`select t.id, t.name, t.course_id from fkh_tee_sets t
      join fkh_courses c on c.id=t.course_id where c.visibility='shared'
      and (select count(*) from fkh_holes h where h.tee_set_id=t.id)>=9
      order by c.name, t.yards desc limit 1`;
    expect(tee).toBeTruthy();
    const query = new URLSearchParams({ courseId: tee.course_id, teeSetId: tee.id });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/surface/workbench?next=${encodeURIComponent(`/play?${query}`)}`);
    const desktop = page.locator("[data-play-desktop-command-centre]");
    await expect(desktop.getByText(tee.name, { exact: true }).first()).toBeVisible();
    await expect(desktop.getByText("4/4 essentials", { exact: true })).toBeVisible();
    await expect(desktop.getByRole("list", { name: "Course preparation status" })).toContainText(
      "Optional",
    );
    const keyHoleLink = desktop.locator('a[href*="&hole="]').first();
    const keyHoleUrl = new URL((await keyHoleLink.getAttribute("href"))!, page.url());
    const hole = keyHoleUrl.searchParams.get("hole")!;
    await page.screenshot({ path: testInfo.outputPath("play-desktop.png"), fullPage: true });
    await keyHoleLink.click();
    const book = page.locator("[data-digital-caddie-book]");
    await expect(book).toBeVisible({ timeout: 60_000 });
    await expect(book).toContainText(tee.name);
    await expect(book.getByRole("button", { name: new RegExp(`^Hole ${hole},`) })).toHaveAttribute(
      "aria-current",
      "true",
    );
    const nextHole = hole === "1" ? "2" : "1";
    await book.getByRole("button", { name: new RegExp(`^Hole ${nextHole},`) }).click();
    await expect(page).toHaveURL(new RegExp(`hole=${nextHole}`));
    await page.reload();
    await expect(
      book.getByRole("button", { name: new RegExp(`^Hole ${nextHole},`) }),
    ).toHaveAttribute("aria-current", "true");
    const selection = page.getByRole("form", { name: "Choose course and tee" });
    await expect(selection.getByRole("combobox", { name: "Tee", exact: true })).toHaveValue(tee.id);
    await selection.getByRole("button", { name: "Load caddie book" }).click();
    await expect(page).toHaveURL(new RegExp(`teeSetId=${tee.id}`));
    await expect(
      book.getByRole("button", { name: new RegExp(`^Hole ${nextHole},`) }),
    ).toHaveAttribute("aria-current", "true");
    const modes = page.getByRole("navigation", { name: "Round strategy" });
    await modes.getByRole("link", { name: "Post-round", exact: true }).click();
    await expect(page).toHaveURL(/mode=post/);
    await expect(modes.getByRole("link", { name: "Pre-round", exact: true })).toHaveAttribute(
      "href",
      new RegExp(`teeSetId=${tee.id}`),
    );
    await modes.getByRole("link", { name: "Pre-round", exact: true }).click();
    await expect(
      book.getByRole("button", { name: new RegExp(`^Hole ${nextHole},`) }),
    ).toHaveAttribute("aria-current", "true");
    await page.goBack();
    await expect(page).toHaveURL(/mode=post/);
    await page.goForward();
    await expect(
      book.getByRole("button", { name: new RegExp(`^Hole ${nextHole},`) }),
    ).toHaveAttribute("aria-current", "true");
    const prepareRound = book.getByRole("link", { name: "Prepare round" });
    await expect(prepareRound).toHaveAttribute("href", `/rounds/new?${query}`);
    await page.screenshot({ path: testInfo.outputPath("strategy-desktop.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/surface/companion?next=${encodeURIComponent(`/play?${query}`)}`);
    await expect(page.locator("[data-selected-course]")).toContainText(tee.name);
    await page.getByText("Your preparation checklist", { exact: true }).click();
    await expect(page.locator("[data-pre-round-readiness]")).toContainText("Optional");
    await page.screenshot({ path: testInfo.outputPath("play-phone.png"), fullPage: true });
    await page.getByRole("link", { name: "Prepare Course", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`teeSetId=${tee.id}`));
    await expect(page.getByRole("heading", { name: "Hole 1", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next hole" }).click();
    await expect(page.getByRole("heading", { name: "Hole 2", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Hole 2", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("strategy-phone.png"), fullPage: true });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  } finally {
    await sql.end();
  }
});
