import { expect, test } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("Course Twin pilot", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});

  test("opens from course and round entry points with authenticated API boundaries", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    skipWhenNoAuth();

    await page.goto("/courses", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expectPageReady(page, /Courses/i);

    const bootleCourseLink = page
      .getByRole("article")
      .filter({ hasText: /Bootle Golf Course/i })
      .getByRole("link", { name: "Map", exact: true });
    await expect(bootleCourseLink).toBeVisible();
    await bootleCourseLink.click();
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
      quality: { grade: "D", verified: false },
      supportedModes: ["flyover", "replay"],
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
    await expect(page.getByText("Grade D prototype")).toBeVisible();
    await expect(page.getByText("Semantic Course Twin · prototype terrain")).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();

    await page.goto("/rounds", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expectPageReady(page, /Rounds/i);
    const latestRoundLink = page.getByRole("link", { name: "Review round", exact: true }).first();
    await expect(latestRoundLink).toBeVisible();
    await latestRoundLink.click();
    await expectPageReady(page, /Round review|Aintree Golf Centre/i);

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
    await expect(page.getByText("Course Twin unavailable")).toBeVisible();
  });
});
