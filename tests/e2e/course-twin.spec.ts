import { expect, test } from "@playwright/test";

import { expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("Course Twin", () => {
  test("opens the playable twin from course and round entry points with authenticated API boundaries", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    skipWhenNoAuth();

    await page.goto("/courses", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expectPageReady(page, /Courses/i);

    const bootleCourseLink = page.getByRole("link", { name: /Bootle Golf Course/i }).first();
    await expect(bootleCourseLink).toBeVisible();
    const bootleCourseHref = await bootleCourseLink.getAttribute("href");
    const listedCourseId = bootleCourseHref?.match(/^\/courses\/([0-9a-f-]+)\//)?.[1];
    expect(listedCourseId).toBeTruthy();
    await page.goto(`/courses/${listedCourseId}/holes`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expectPageReady(page, /Bootle Golf Course/i);

    const pilotLink = page.getByRole("link", { name: "3D pilot", exact: true });
    await expect(pilotLink).toBeVisible();
    const pilotHref = await pilotLink.getAttribute("href");
    expect(pilotHref).toMatch(/^\/play\/[0-9a-f-]+$/);
    const courseId = pilotHref?.split("/").at(-1);
    expect(courseId).toBeTruthy();

    const manifestResponse = await page.request.get(`/api/course-twins/${courseId}/manifest`);
    expect(manifestResponse.status()).toBe(200);
    await expect(manifestResponse.json()).resolves.toMatchObject({
      schemaVersion: 1,
      course: { id: courseId },
      quality: { grade: "B", verified: false },
      supportedModes: ["flyover", "replay", "strategy", "play"],
    });

    const replayResponse = await page.request.get(`/api/course-twins/${courseId}/replay`);
    expect([200, 404]).toContain(replayResponse.status());
    if (replayResponse.status() === 404) {
      await expect(replayResponse.json()).resolves.toEqual({ error: "No eligible replay found" });
    }

    const missingCourseId = "00000000-0000-4000-8000-000000000000";
    for (const endpoint of ["manifest", "replay"]) {
      const missingResponse = await page.request.get(
        `/api/course-twins/${missingCourseId}/${endpoint}`,
      );
      expect(missingResponse.status()).toBe(404);
      await expect(missingResponse.json()).resolves.toEqual({ error: "Course Twin not found" });
    }

    await pilotLink.click();
    await expect(page).toHaveURL(new RegExp(`/play/${courseId}$`));
    await expect(page.getByText(/Grade B · 2\.4 m terrain/)).toBeVisible();
    await expect(page.getByText("LiDAR Course Twin · 2.4 m runtime mesh")).toBeVisible();
    await expect(page.getByRole("button", { name: "Strategy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Live" })).toBeVisible();
    await expect(page.getByText("Camera controls")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();

    await page.getByRole("button", { name: "Explore" }).click();
    await expect(page.getByRole("button", { name: "Walk" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cart" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start group session" })).toBeVisible();
    if (testInfo.project.name === "chromium") {
      await page.getByRole("button", { name: "Start group session" }).click();
      await expect(page.getByText(/1 of 4 golfers connected/)).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(async () => {
          return page.evaluate(() => {
            const state = JSON.parse(
              (
                window as typeof window & { render_game_to_text?: () => string }
              ).render_game_to_text?.() ?? "{}",
            );
            return state.exploration?.groupSession?.inviteCode ?? null;
          });
        })
        .toMatch(/^[A-Z2-9]{8}$/);
    }

    await page.getByRole("button", { name: "Cart" }).click();
    const beforeCart = await readExplorationPosition(page);
    await page.keyboard.down("ArrowUp");
    await page.evaluate(() => {
      const gameWindow = window as typeof window & { advanceTime?: (milliseconds: number) => void };
      for (let frame = 0; frame < 60; frame += 1) gameWindow.advanceTime?.(1000 / 60);
    });
    await page.keyboard.up("ArrowUp");
    await expect.poll(() => readExplorationPosition(page)).not.toEqual(beforeCart);
    if (testInfo.project.name === "chromium") {
      await page.getByRole("button", { name: "Leave group" }).click();
      await expect(page.getByRole("button", { name: "Start group session" })).toBeVisible();
    }

    const bootleSessionId = "7aca3491-bd8d-4016-a05c-d1ba87f87db4";
    await page.goto(`/rounds/${bootleSessionId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expectPageReady(page, /Round review|Bootle Golf Course/i);

    const replayPilotLink = page.getByRole("link", {
      name: "3D replay pilot",
      exact: true,
    });
    await expect(replayPilotLink).toBeVisible();
    await expect(replayPilotLink).toHaveAttribute(
      "href",
      /^\/play\/[0-9a-f-]+\?sessionId=[0-9a-f-]+$/,
    );
    await replayPilotLink.click();
    await expect(page).toHaveURL(/\/play\/[0-9a-f-]+\?sessionId=[0-9a-f-]+$/);
    await expect(page.getByText(/Grade B · 2\.4 m terrain/)).toBeVisible();
    await expect(page.getByText("Shot 1")).toBeVisible();
  });
});

async function readExplorationPosition(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const state = JSON.parse(
      (window as typeof window & { render_game_to_text?: () => string }).render_game_to_text?.() ??
        "{}",
    );
    return state.exploration?.position ?? null;
  });
}
