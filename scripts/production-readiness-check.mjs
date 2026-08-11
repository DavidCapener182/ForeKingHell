import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const checks = [
  ["npm", ["run", "format:check"]],
  ["npm", ["run", "lint"]],
  ["npx", ["next", "typegen"]],
  ["npx", ["tsc", "--noEmit"]],
  ["npm", ["run", "test"]],
  ["npx", ["drizzle-kit", "check"]],
  ["npm", ["audit", "--audit-level=high"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "check:route-budgets"]],
  ["npm", ["run", "test:lighthouse"]],
  // Playwright starts the already-built production server for this release gate. A green run
  // still exercises the complete configured matrix. Stop on the first browser failure so a
  // known defect does not consume the rest of a multi-project release run.
  ["npm", ["run", "test:e2e", "--", "--max-failures=1"]],
  ["git", ["diff", "--check"]],
];

const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE;
const authStateResult = loadAuthenticatedStorageState(authStatePath);
const authState = authStateResult.state;
const hasAuthState = Boolean(authState);
const authenticatedE2eEnv = {
  PLAYWRIGHT_SERVER_MODE: "production",
  PLAYWRIGHT_E2E_AUTH_BYPASS: "0",
  SCORECARD_PROOF_SECRET:
    process.env.SCORECARD_PROOF_SECRET?.trim() ||
    "playwright-scorecard-proof-secret-with-more-than-32-characters",
};
const failedChecks = [];

if (!hasAuthState) {
  console.warn(
    `Authenticated E2E not fully verified: ${authStateResult.error ?? "PLAYWRIGHT_AUTH_STATE is missing."}`,
  );
}

for (const [command, args] of checks) {
  const label = [command, ...args].join(" ");
  console.log(`\n==> ${label}`);
  const env = await envForCheck(command, args);
  const code = await run(command, args, env);

  if (code !== 0) {
    failedChecks.push(`${label} exited ${code}`);
  }
}

if (!hasAuthState) {
  failedChecks.push(
    `${authStateResult.error ?? "PLAYWRIGHT_AUTH_STATE is missing."} Authenticated E2E coverage incomplete.`,
  );
}

if (failedChecks.length > 0) {
  console.error("\nProduction readiness gate failed:");
  for (const failure of failedChecks) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("\nProduction readiness gate passed.");
}

async function envForCheck(command, args) {
  if (isLighthouseCheck(command, args) && authState) {
    return {
      ...process.env,
      LIGHTHOUSE_COOKIE:
        process.env.LIGHTHOUSE_COOKIE?.trim() || cookieHeaderFromStorageState(authState),
    };
  }

  if (isE2eCheck(command, args)) {
    return {
      ...process.env,
      ...authenticatedE2eEnv,
    };
  }

  return process.env;
}

function isE2eCheck(command, args) {
  return command === "npm" && args[0] === "run" && args[1] === "test:e2e";
}

function isLighthouseCheck(command, args) {
  return command === "npm" && args[0] === "run" && args[1] === "test:lighthouse";
}

function loadAuthenticatedStorageState(path) {
  if (!path || !existsSync(path)) {
    return { state: null, error: "PLAYWRIGHT_AUTH_STATE is missing." };
  }

  try {
    const state = JSON.parse(readFileSync(path, "utf8"));
    const authCookieValue = combinedAuthCookieValue(state.cookies);

    if (!authCookieValue) {
      return { state: null, error: "PLAYWRIGHT_AUTH_STATE has no Supabase auth cookie." };
    }

    const session = parsedAuthSession(authCookieValue);
    const accessToken = Array.isArray(session) ? session[0] : session?.access_token;
    const [headerPart, payloadPart] = typeof accessToken === "string" ? accessToken.split(".") : [];
    const header = headerPart
      ? JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"))
      : null;
    const claims = payloadPart
      ? JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"))
      : null;
    const authenticatedAudience = Array.isArray(claims?.aud)
      ? claims.aud.includes("authenticated")
      : claims?.aud === "authenticated";

    if (!claims?.sub || !authenticatedAudience || header?.alg === "none") {
      return {
        state: null,
        error: "PLAYWRIGHT_AUTH_STATE contains a local bypass token, not a Supabase session.",
      };
    }

    return { state, error: null };
  } catch {
    return { state: null, error: "PLAYWRIGHT_AUTH_STATE is invalid or unreadable." };
  }
}

function combinedAuthCookieValue(cookies) {
  if (!Array.isArray(cookies)) {
    return null;
  }

  const authCookies = cookies.filter((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name));
  const wholeCookie = authCookies.find((cookie) => /^sb-.+-auth-token$/.test(cookie.name));

  if (wholeCookie) {
    return wholeCookie.value;
  }

  return authCookies
    .map((cookie) => {
      const match = cookie.name.match(/^(sb-.+-auth-token)\.(\d+)$/);
      return match ? { baseName: match[1], index: Number(match[2]), value: cookie.value } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.index - right.index)
    .map((cookie) => cookie.value)
    .join("");
}

function parsedAuthSession(cookieValue) {
  let decoded = decodeURIComponent(cookieValue);

  if (decoded.startsWith("base64-")) {
    decoded = Buffer.from(decoded.slice("base64-".length), "base64url").toString("utf8");
  }

  return JSON.parse(decoded);
}

function cookieHeaderFromStorageState(state) {
  return state.cookies
    .filter((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env,
    });

    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });
  });
}
