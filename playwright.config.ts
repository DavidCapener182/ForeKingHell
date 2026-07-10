import { defineConfig, devices } from "@playwright/test";

import { createLocalBypassStorageState, localAuthBypassEnabled } from "./tests/e2e/local-auth";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const localBypassStorageState = localAuthBypassEnabled(baseURL)
  ? createLocalBypassStorageState(baseURL)
  : undefined;
const desktopViewportProjects = [
  { name: "desktop-1024x768", width: 1024, height: 768 },
  { name: "desktop-1280x720", width: 1280, height: 720 },
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-2560x1440", width: 2560, height: 1440 },
];

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    storageState: localBypassStorageState,
    serviceWorkers: "block",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...desktopViewportProjects.map((viewport) => ({
      name: viewport.name,
      use: {
        browserName: "chromium" as const,
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    })),
    {
      name: "mobile-small",
      use: {
        browserName: "chromium",
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-iphone",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-pixel",
      use: {
        browserName: "chromium",
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-ipad-mini",
      use: {
        browserName: "chromium",
        viewport: { width: 744, height: 1133 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-landscape",
      use: {
        browserName: "chromium",
        viewport: { width: 844, height: 390 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --webpack --port ${port}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX ?? "5",
          NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=12288",
        },
      },
});
