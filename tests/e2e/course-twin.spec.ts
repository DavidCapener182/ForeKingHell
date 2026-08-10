import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("Course Twin", () => {
  test("serves and browser-renders every verified first-wave package", async ({
    browser,
    page,
  }) => {
    test.setTimeout(360_000);
    skipWhenNoAuth();
    const report = JSON.parse(
      readFileSync(
        resolve("tools/course-twin-builder/catalog/uk-first-wave-packages.json"),
        "utf8",
      ),
    ) as {
      completed: number;
      packageGenerationComplete: boolean;
      manualVisualQaComplete: boolean;
      packages: Array<{
        courseId: string;
        slug: string;
        qualityGrade: string;
        mappedHoles: number;
        assets: Array<{ fileName: string; byteLength: number }>;
      }>;
    };
    expect(report.packageGenerationComplete).toBe(true);
    expect(report.manualVisualQaComplete).toBe(true);
    expect(report.completed).toBeGreaterThanOrEqual(20);
    expect(report.completed).toBeLessThanOrEqual(50);

    for (const entry of report.packages) {
      const response = await page.request.get(`/api/course-twins/${entry.courseId}/manifest`);
      expect(response.status(), `${entry.slug} manifest`).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        course: { id: entry.courseId },
        quality: { grade: entry.qualityGrade, mappedHoles: entry.mappedHoles },
      });
      for (const asset of entry.assets) {
        const assetResponse = await page.request.get(
          `/course-twins/${entry.slug}/${asset.fileName}`,
        );
        expect(assetResponse.status(), `${entry.slug}/${asset.fileName}`).toBe(200);
        expect((await assetResponse.body()).byteLength).toBe(asset.byteLength);
      }
    }

    const storageState = await page.context().storageState();
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
    for (const entry of report.packages) {
      const context = await browser.newContext({ baseURL, storageState, serviceWorkers: "block" });
      const renderPage = await context.newPage();
      const courseRequestFailures: string[] = [];
      const coursePaths = [
        `/play/${entry.courseId}`,
        `/api/course-twins/${entry.courseId}`,
        `/course-twins/${entry.slug}/`,
      ];
      renderPage.on("response", (response) => {
        const pathname = new URL(response.url()).pathname;
        if (response.status() >= 400 && coursePaths.some((path) => pathname.startsWith(path))) {
          courseRequestFailures.push(`${response.status()} ${pathname}`);
        }
      });
      renderPage.on("requestfailed", (request) => {
        const pathname = new URL(request.url()).pathname;
        const errorText = request.failure()?.errorText;
        if (
          errorText !== "net::ERR_ABORTED" &&
          coursePaths.some((path) => pathname.startsWith(path))
        ) {
          courseRequestFailures.push(`network ${pathname}: ${errorText}`);
        }
      });
      try {
        await renderPage.goto(`/play/${entry.courseId}`, {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        await expect(renderPage.getByText(/Grade B/)).toBeVisible();
        await expect(renderPage.locator("canvas")).toBeVisible();
        await expect
          .poll(
            () =>
              renderPage.evaluate(() => {
                const gameWindow = window as typeof window & {
                  render_game_to_text?: () => string;
                };
                const state = JSON.parse(gameWindow.render_game_to_text?.() ?? "{}");
                return state.terrain?.status ?? null;
              }),
            { message: `${entry.slug} terrain readiness` },
          )
          .toBe("ready");
        expect(courseRequestFailures, entry.slug).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });

  test("opens the playable twin from course and round entry points with authenticated API boundaries", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    skipWhenNoAuth();

    await page.goto("/course-twins", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expectPageReady(page, /Course Twin/i);
    await expect(
      page.getByRole("link", { name: "Course Twin", exact: true }).first(),
    ).toBeVisible();
    const bootleCard = page.locator("article").filter({ hasText: "Bootle Golf Course (Bootle)" });
    await expect(bootleCard).toBeVisible();
    const bootleTwinLink = bootleCard.getByRole("link", {
      name: "Open Course Twin",
      exact: true,
    });
    await expect(bootleTwinLink).toBeVisible();
    const bootleTwinHref = await bootleTwinLink.getAttribute("href");
    const listedCourseId = bootleTwinHref?.match(/^\/play\/([0-9a-f-]+)$/)?.[1];
    expect(listedCourseId).toBeTruthy();
    await page.goto(`/courses/${listedCourseId}/holes`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expectPageReady(page, /Bootle Golf Course/i);

    const pilotLink = page.getByRole("link", { name: "Open Course Twin", exact: true });
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
      supportedModes: ["flyover", "replay", "strategy", "play", "live", "explore"],
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
    await expect(page.getByRole("button", { name: "Join as spectator" })).toBeVisible();
    if (testInfo.project.name === "chromium") {
      await page.getByRole("button", { name: "Competition" }).click();
      await page.getByRole("button", { name: "Public lobby" }).click();
      await page.getByRole("button", { name: "Start group session" }).click();
      await expect(page.getByText("Verified competition room")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/Public lobby.*You joined as host/)).toBeVisible();
      await expect(page.getByText(/1 golfer\(s\) · 0 spectator\(s\) connected/)).toBeVisible();
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

      const group = await readGroupSession(page);
      expect(group).toMatchObject({
        role: "host",
        competition: true,
        visibility: "public",
        sharedRoundVersion: 1,
        sharedEventCount: 0,
      });
      const publicRooms = await page.request.get(`/api/course-twins/${courseId}/rooms/public`);
      expect(publicRooms.status()).toBe(200);
      await expect(publicRooms.json()).resolves.toMatchObject({
        rooms: expect.arrayContaining([expect.objectContaining({ id: group.roomId })]),
      });
      await page.getByLabel("Group chat message").fill("Course Twin browser chat verified");
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.getByText("Course Twin browser chat verified")).toBeVisible({
        timeout: 10_000,
      });
      await page.context().grantPermissions(["microphone"], { origin: new URL(page.url()).origin });
      await page.getByRole("button", { name: "Enable voice" }).click();
      await expect(page.getByRole("button", { name: "Voice on" })).toBeVisible({
        timeout: 10_000,
      });
      const sharedResult = await page.request.post(
        `/api/course-twins/rooms/${group.roomId}/shared-round/events`,
        {
          data: {
            expectedVersion: group.sharedRoundVersion,
            event: {
              type: "round.abandoned",
              clientEventId: crypto.randomUUID(),
              payload: { reason: "Course Twin shared-round E2E" },
            },
          },
        },
      );
      expect(sharedResult.status()).toBe(201);
      const shared = await sharedResult.json();
      expect(shared.room.finalEventHash).toMatch(/^[0-9a-f]{64}$/);
      const ledger = await page.request.get(
        `/api/course-twins/rooms/${group.roomId}/shared-round/events`,
      );
      expect(ledger.status()).toBe(200);
      await expect(ledger.json()).resolves.toMatchObject({
        events: [{ sequence: 1, previousHash: null, eventType: "round.abandoned" }],
      });
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
      name: "Open 3D replay",
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

  test("opens the existing Aintree course as a nine-hole Grade B twin", async ({ page }) => {
    test.setTimeout(120_000);
    skipWhenNoAuth();
    const aintreeCourseId = "4de11156-16fd-4a36-84e0-fadda53456b0";

    const manifestResponse = await page.request.get(
      `/api/course-twins/${aintreeCourseId}/manifest`,
    );
    expect(manifestResponse.status()).toBe(200);
    await expect(manifestResponse.json()).resolves.toMatchObject({
      course: { id: aintreeCourseId, name: "Aintree Golf Centre" },
      quality: { grade: "B", mappedHoles: 9, verified: false },
    });

    await page.goto("/course-twins", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expectPageReady(page, /Course Twin/i);
    await expect(page.getByRole("heading", { name: "Course Twin", exact: true })).toBeVisible();
    const aintreeCard = page.locator("article").filter({ hasText: "Aintree Golf Centre" });
    await expect(aintreeCard).toBeVisible();
    await expect(aintreeCard.getByText("Grade B")).toBeVisible();
    await aintreeCard.getByRole("link", { name: "Open Course Twin" }).click();
    await expect(page).toHaveURL(`/play/${aintreeCourseId}`);
    await expectPageReady(page, /Aintree Golf Centre/i);
    await expect(page.getByText(/Grade B/)).toBeVisible();
    await expect(page.getByRole("button", { name: "9" })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("keeps Course Twin full-screen with every mobile control inside the viewport", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    test.skip(testInfo.project.name !== "chromium", "The viewport matrix runs once in Chromium.");
    skipWhenNoAuth();

    const courseId = "4de11156-16fd-4a36-84e0-fadda53456b0";
    const mobileViewports = [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 844, height: 390 },
    ] as const;

    await page.setViewportSize(mobileViewports[0]);
    await page.goto(`/play/${courseId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expectPageReady(page, /Aintree Golf Centre/i);

    for (const viewport of mobileViewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      await expect(page).toHaveURL(new RegExp(`/play/${courseId}$`));

      const immersiveViewport = page.locator("[data-course-twin-viewport]");
      const stage = page.locator("[data-course-twin-stage]");
      const canvas = stage.locator("canvas");
      const exit = page.getByRole("link", { name: "Exit Course Twin" });
      const course = page.getByRole("button", { name: "Open course controls" });
      const details = page.getByRole("button", { name: "Open shot details" });
      const modeDock = page.locator("[data-course-twin-mode-dock]");
      const actionTray = page.locator("[data-course-twin-action-tray]");

      await expect(immersiveViewport).toBeVisible();
      await expect(stage).toBeVisible();
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await expect(exit).toBeVisible();
      await expect(course).toBeVisible();
      await expect(details).toBeVisible();
      await expect(modeDock).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Mobile primary" })).toHaveCount(0);
      await expect(page.getByRole("banner", { name: "Mobile app bar" })).toHaveCount(0);

      const layout = await readImmersiveCourseTwinLayout(page);
      expect(layout.pageHeight).toBeLessThanOrEqual(viewport.height + 2);
      expect(layout.pageWidth).toBeLessThanOrEqual(viewport.width + 2);
      expect(layout.scrollX).toBe(0);
      expect(layout.scrollY).toBe(0);
      expectBoxFillsViewport(layout.viewport, viewport);
      expectBoxFillsViewport(layout.stage, viewport);
      expectBoxFillsViewport(layout.canvas, viewport);
      expectBoxInsideViewport(layout.exit, viewport, 44);
      expectBoxInsideViewport(layout.course, viewport, 44);
      expectBoxInsideViewport(layout.details, viewport, 44);
      expectBoxInsideViewport(layout.modeDock, viewport);
      expect(layout.modeDockScrollWidth).toBeLessThanOrEqual(layout.modeDockClientWidth + 1);
      expect(layout.modes.map((item) => item.label)).toEqual([
        "Flyover",
        "Replay",
        "Strategy",
        "Play",
        "Live",
        "Explore",
      ]);
      for (const modeControl of layout.modes) {
        expectBoxInsideViewport(modeControl.box, viewport, 44);
      }

      for (const label of ["Flyover", "Replay", "Strategy", "Play", "Live", "Explore"]) {
        const modeControl = modeDock.getByRole("button", { name: label, exact: true });
        await expect(modeControl).toBeVisible();
      }

      const playMode = modeDock.getByRole("button", { name: "Play", exact: true });
      await playMode.click();
      await expect(playMode).toHaveAttribute("aria-pressed", "true");
      await expect(actionTray).toBeVisible();
      expectBoxInsideViewport(
        await readElementBox(page, "[data-course-twin-action-tray]"),
        viewport,
      );

      const compactActions = actionTray.locator("button:visible, select:visible, input:visible");
      const compactActionBoxes = await compactActions.evaluateAll((controls) =>
        controls.map((control) => {
          const rectangle = control.getBoundingClientRect();
          return {
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
          };
        }),
      );
      expect(compactActionBoxes.length).toBeGreaterThan(0);
      for (const box of compactActionBoxes) {
        expectBoxInsideViewport(box, viewport, 44);
      }

      if (viewport.width === 390) {
        await details.click();
        const shotControls = page.locator("[data-course-twin-shot-controls]");
        await expect(shotControls).toBeVisible();
        await expect(shotControls).toHaveAttribute("role", "dialog");
        await expect(shotControls).toHaveAttribute("aria-modal", "true");
        const closeDetails = page.getByRole("button", { name: "Close analysis controls" });
        await expect(closeDetails).toBeFocused();
        expectBoxInsideViewport(
          await readElementBox(page, "[data-course-twin-shot-controls]"),
          viewport,
        );
        await page.keyboard.press("Escape");
        await expect(shotControls).toBeHidden();
        await expect(details).toBeFocused();

        await modeDock.getByRole("button", { name: "Explore", exact: true }).click();
        const exploreMovement = page.getByRole("group", { name: "Explore movement" });
        await expect(exploreMovement).toBeVisible();
        await expect(exploreMovement.getByRole("button", { name: "Forward" })).toBeVisible();
      }
    }

    await Promise.all([
      page.waitForURL(/\/course-twins$/),
      page.getByRole("link", { name: "Exit Course Twin" }).click({ noWaitAfter: true }),
    ]);

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`/play/${courseId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expectPageReady(page, /Aintree Golf Centre/i);
    await expect(page.locator("[data-desktop-workbench-hydrated]")).toHaveAttribute(
      "data-desktop-workbench-hydrated",
      "true",
    );
    await expect(page.getByRole("link", { name: "Exit Course Twin" })).toBeHidden();
    await expect(page.locator("[data-course-twin-mobile-chrome]")).toBeHidden();
    await expect(page.locator("[data-course-twin-stage] canvas")).toBeVisible({ timeout: 30_000 });
    const desktopMetrics = await page.evaluate(() => {
      const root = document.documentElement;
      const viewport = document.querySelector<HTMLElement>("[data-course-twin-viewport]");
      return {
        pageWidth: root.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportPosition: viewport ? getComputedStyle(viewport).position : null,
      };
    });
    expect(desktopMetrics.pageWidth).toBeLessThanOrEqual(desktopMetrics.viewportWidth + 2);
    expect(desktopMetrics.viewportPosition).not.toBe("fixed");
  });

  test("starts, resumes and safely abandons a persisted My Bag round", async ({ page }) => {
    test.setTimeout(120_000);
    skipWhenNoAuth();
    const courseId = "9beb5429-67e4-4f4e-a187-adbe0df74b62";

    const existingResponse = await page.request.get(`/api/course-twins/${courseId}/rounds`);
    expect(existingResponse.status()).toBe(200);
    const existing = await existingResponse.json();
    if (existing?.id) {
      const abandonResponse = await page.request.post(
        `/api/course-twins/rounds/${existing.id}/events`,
        {
          data: {
            expectedVersion: existing.version,
            event: {
              type: "round.abandoned",
              clientEventId: crypto.randomUUID(),
              payload: { reason: "Course Twin E2E cleanup" },
            },
          },
        },
      );
      expect([200, 201]).toContain(abandonResponse.status());
    }

    await page.goto(`/play/${courseId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expectPageReady(page, /Bootle Golf Course/i);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByText("Start My Bag round")).toBeVisible();
    await page.getByRole("button", { name: "Front 9" }).click();
    await page.getByRole("button", { name: "8 mph" }).click();
    await page.getByRole("button", { name: "From W" }).click();
    await page.getByRole("button", { name: "Start 9-hole My Bag round" }).click();
    await expect(page.getByText("Verified round ledger")).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(() => readRoundLedger(page))
      .toMatchObject({
        mode: "play",
        status: "in_progress",
        holeCount: 9,
        currentHole: 1,
        rules: { windSpeedMph: 8, windDirectionDeg: 270 },
      });
    const round = await readRoundLedger(page);
    expect(round).toBeTruthy();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Verified round ledger")).toBeVisible({ timeout: 30_000 });
    const resumed = await readRoundLedger(page);
    expect(resumed.id).toBe(round.id);
    expect(resumed.version).toBe(round.version);

    const invalidResult = await page.request.post(`/api/course-twins/rounds/${resumed.id}/events`, {
      data: {
        expectedVersion: resumed.version,
        event: {
          type: "hole.completed",
          clientEventId: crypto.randomUUID(),
          payload: {
            holeNumber: 1,
            par: 3,
            yards: 390,
            strokes: 2,
            putts: 2,
            penalties: 1,
            fairwayHit: null,
            gir: null,
          },
        },
      },
    });
    expect(invalidResult.status()).toBe(422);

    const abandonResult = await page.request.post(`/api/course-twins/rounds/${resumed.id}/events`, {
      data: {
        expectedVersion: resumed.version,
        event: {
          type: "round.abandoned",
          clientEventId: crypto.randomUUID(),
          payload: { reason: "Course Twin E2E completed" },
        },
      },
    });
    expect([200, 201]).toContain(abandonResult.status());
    await expect(
      page.request.get(`/api/course-twins/${courseId}/rounds`).then((response) => response.json()),
    ).resolves.toBeNull();
  });

  test("plays and persists an opt-in manual putt from the mapped Grade B green", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    skipWhenNoAuth();
    const courseId = "9beb5429-67e4-4f4e-a187-adbe0df74b62";

    const existingResponse = await page.request.get(`/api/course-twins/${courseId}/rounds`);
    expect(existingResponse.status()).toBe(200);
    const existing = await existingResponse.json();
    if (existing?.id) {
      const cleanup = await page.request.post(`/api/course-twins/rounds/${existing.id}/events`, {
        data: {
          expectedVersion: existing.version,
          event: {
            type: "round.abandoned",
            clientEventId: crypto.randomUUID(),
            payload: { reason: "Course Twin manual-putt E2E setup" },
          },
        },
      });
      expect([200, 201]).toContain(cleanup.status());
    }

    const manifestResponse = await page.request.get(`/api/course-twins/${courseId}/manifest`);
    expect(manifestResponse.status()).toBe(200);
    const manifest = (await manifestResponse.json()) as {
      holes: Array<{
        holeNumber: number;
        tee: [number, number, number];
        green: [number, number, number];
      }>;
    };
    const hole = manifest.holes.find((candidate) => candidate.holeNumber === 1);
    expect(hole).toBeTruthy();

    const strategyResponse = await page.request.get(
      `/api/course-twins/${courseId}/strategy?holeNumber=1`,
    );
    expect(strategyResponse.status()).toBe(200);
    const strategy = (await strategyResponse.json()) as {
      recommended: { clubId: string; clubType: string };
    };
    expect(strategy.recommended?.clubId).toBeTruthy();

    const createResponse = await page.request.post(`/api/course-twins/${courseId}/rounds`, {
      data: {
        mode: "play",
        holeCount: 9,
        startingHole: 1,
        rules: {
          windSpeedMph: 0,
          windDirectionDeg: 0,
          greenRule: "manual_putts",
          mulligansAllowed: true,
          competition: false,
        },
      },
    });
    expect(createResponse.status()).toBe(201);
    const round = await createResponse.json();
    const green = hole!.green;
    const greenStart: [number, number, number] = [green[0] + 0.45, green[1], green[2]];
    const shotResponse = await page.request.post(`/api/course-twins/rounds/${round.id}/events`, {
      data: {
        expectedVersion: round.version,
        event: {
          type: "shot.accepted",
          clientEventId: crypto.randomUUID(),
          payload: {
            holeNumber: 1,
            shotNumber: 1,
            clubId: strategy.recommended.clubId,
            clubType: strategy.recommended.clubType,
            source: "modelled",
            start: hole!.tee,
            carryEnd: greenStart,
            totalEnd: greenStart,
            metrics: {
              carryYd: 189,
              totalYd: 189,
              ballSpeedMph: 128,
              clubSpeedMph: null,
              launchAngleDeg: 16,
              launchDirectionDeg: 0,
              spinRate: 5100,
              spinAxis: 0,
            },
            result: {
              finalSurface: "green",
              penalty: null,
              bounceCount: 2,
            },
          },
        },
      },
    });
    expect(shotResponse.status()).toBe(201);

    await page.goto(`/play/${courseId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await expectPageReady(page, /Bootle Golf Course/i);
    await expect(page.getByText(/Approximate green · putt 1/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/ft to the cup/i)).toBeVisible();
    await expect.poll(async () => (await readManualPutting(page))?.status).toBe("ready");

    await page.getByRole("button", { name: "Play putt" }).click();
    await expect.poll(async () => (await readRoundLedger(page))?.currentHole).toBe(2);

    const persistedResponse = await page.request.get(`/api/course-twins/rounds/${round.id}`);
    expect(persistedResponse.status()).toBe(200);
    await expect(persistedResponse.json()).resolves.toMatchObject({
      currentHole: 2,
      summary: {
        acceptedPutts: [{ holeNumber: 1, puttNumber: 1, holed: true }],
        scorecard: [{ holeNumber: 1, strokes: 2, putts: 1 }],
      },
    });

    const activeResponse = await page.request.get(`/api/course-twins/${courseId}/rounds`);
    const active = await activeResponse.json();
    if (active?.id) {
      const abandonResponse = await page.request.post(
        `/api/course-twins/rounds/${active.id}/events`,
        {
          data: {
            expectedVersion: active.version,
            event: {
              type: "round.abandoned",
              clientEventId: crypto.randomUUID(),
              payload: { reason: "Course Twin manual-putt E2E completed" },
            },
          },
        },
      );
      expect([200, 201]).toContain(abandonResponse.status());
    }
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

async function readRoundLedger(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const state = JSON.parse(
      (window as typeof window & { render_game_to_text?: () => string }).render_game_to_text?.() ??
        "{}",
    );
    return state.roundLedger ?? null;
  });
}

async function readManualPutting(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const state = JSON.parse(
      (window as typeof window & { render_game_to_text?: () => string }).render_game_to_text?.() ??
        "{}",
    );
    return state.manualPutting ?? null;
  });
}

async function readGroupSession(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const state = JSON.parse(
      (window as typeof window & { render_game_to_text?: () => string }).render_game_to_text?.() ??
        "{}",
    );
    return state.exploration?.groupSession ?? null;
  });
}

type ElementBox = { x: number; y: number; width: number; height: number };
type TestViewport = { width: number; height: number };

async function readImmersiveCourseTwinLayout(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    window.scrollTo({ top: 500, left: 500, behavior: "instant" });
    const root = document.documentElement;
    const requiredElement = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing immersive Course Twin element: ${selector}`);
      return element;
    };
    const box = (element: Element) => {
      const rectangle = element.getBoundingClientRect();
      return {
        x: rectangle.x,
        y: rectangle.y,
        width: rectangle.width,
        height: rectangle.height,
      };
    };
    const modeDock = requiredElement("[data-course-twin-mode-dock]");
    return {
      pageHeight: root.scrollHeight,
      pageWidth: root.scrollWidth,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewport: box(requiredElement("[data-course-twin-viewport]")),
      stage: box(requiredElement("[data-course-twin-stage]")),
      canvas: box(requiredElement("[data-course-twin-stage] canvas")),
      exit: box(requiredElement("[data-course-twin-exit]")),
      course: box(
        requiredElement(
          '[data-course-twin-mobile-chrome] button[aria-label="Open course controls"]',
        ),
      ),
      details: box(
        requiredElement('[data-course-twin-mobile-chrome] button[aria-label="Open shot details"]'),
      ),
      modeDock: box(modeDock),
      modeDockClientWidth: modeDock.clientWidth,
      modeDockScrollWidth: modeDock.scrollWidth,
      modes: Array.from(modeDock.querySelectorAll("button")).map((button) => ({
        label: button.textContent?.trim() ?? "",
        box: box(button),
      })),
    };
  });
}

async function readElementBox(page: import("@playwright/test").Page, selector: string) {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector<HTMLElement>(targetSelector);
    if (!element) throw new Error(`Missing Course Twin element: ${targetSelector}`);
    const rectangle = element.getBoundingClientRect();
    return {
      x: rectangle.x,
      y: rectangle.y,
      width: rectangle.width,
      height: rectangle.height,
    };
  }, selector);
}

function expectBoxInsideViewport(box: ElementBox, viewport: TestViewport, minimumHeight = 0) {
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(box.height).toBeGreaterThanOrEqual(minimumHeight);
}

function expectBoxFillsViewport(box: ElementBox, viewport: TestViewport) {
  expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
  expect(box.height).toBeGreaterThanOrEqual(viewport.height - 2);
}
