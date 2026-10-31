import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "bag-benchmark-text.spec.ts",
  timeout: 180000,
  workers: 1,
  use: { browserName: "chromium", headless: true },
  reporter: "list",
});
