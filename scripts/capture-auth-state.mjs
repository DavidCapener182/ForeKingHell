#!/usr/bin/env node

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const baseOrigin = new URL(baseUrl).origin;
const outputPath = resolve(
  process.env.PLAYWRIGHT_AUTH_STATE ?? ".playwright/auth/forekinghell-state.json",
);
const loginPath = process.env.AUTH_STATE_LOGIN_PATH ?? "/login";
const verifyPath = process.env.AUTH_STATE_VERIFY_PATH ?? "/dashboard";
const timeoutMs = Number(process.env.AUTH_STATE_TIMEOUT_MS ?? 5 * 60 * 1000);
const headless = process.env.HEADLESS === "1" || process.env.CI === "true";

mkdirSync(dirname(outputPath), { recursive: true });

console.log(`Opening ${resolveUrl(loginPath)} to capture a logged-in Playwright state.`);
console.log("Sign in with the tester account in the opened browser.");
console.log(`State will be saved to ${outputPath}`);

const browser = await chromium.launch({ headless });
const context = await browser.newContext({ baseURL: baseOrigin });
const page = await context.newPage();

try {
  await page.goto(loginPath, { waitUntil: "domcontentloaded" });
  await waitForSignedInRoute(page);
  await page.goto(verifyPath, { waitUntil: "domcontentloaded" });

  if (isLoginUrl(page.url())) {
    throw new Error(
      `The stored session still redirects to ${page.url()}. Sign in fully before saving state.`,
    );
  }

  const state = await context.storageState({ path: outputPath });

  if (!hasAuthMaterial(state)) {
    throw new Error(
      "No Supabase/auth cookies or local storage entries were found in the captured browser state.",
    );
  }

  console.log("Authenticated Playwright state captured.");
  console.log(`Run: PLAYWRIGHT_AUTH_STATE=${outputPath} npm run production:check`);
} finally {
  await browser.close();
}

async function waitForSignedInRoute(page) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!isLoginUrl(page.url()) && !isAuthCallbackUrl(page.url())) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(
    `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for sign-in to leave ${loginPath}.`,
  );
}

function hasAuthMaterial(state) {
  const cookieNames = state.cookies.map((cookie) => cookie.name.toLowerCase());
  const storageNames = state.origins.flatMap((origin) =>
    origin.localStorage.map((entry) => entry.name.toLowerCase()),
  );
  const names = [...cookieNames, ...storageNames];

  return names.some(
    (name) =>
      name.includes("supabase") ||
      name.startsWith("sb-") ||
      name.includes("auth-token") ||
      name.includes("session"),
  );
}

function isLoginUrl(value) {
  const pathname = new URL(value).pathname;

  return pathname === "/login";
}

function isAuthCallbackUrl(value) {
  const pathname = new URL(value).pathname;

  return pathname.startsWith("/auth/");
}

function resolveUrl(pathname) {
  if (/^https?:\/\//i.test(pathname)) {
    return pathname;
  }

  return new URL(pathname, baseOrigin).toString();
}
