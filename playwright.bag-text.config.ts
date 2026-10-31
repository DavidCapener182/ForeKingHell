import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "bag-benchmark-text.spec.ts",
    "bag-mobile-overflow.spec.ts",
    "benchmark-intelligence.spec.ts",
  ],
  timeout: 180000,
  workers: 1,
  use: { headless: true },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  reporter: "list",
});
