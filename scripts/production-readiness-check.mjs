import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const checks = [
  ["npm", ["run", "format:check"]],
  ["npm", ["run", "lint"]],
  ["npx", ["tsc", "--noEmit"]],
  ["npm", ["run", "test"]],
  ["npm", ["run", "build"]],
  ["npm", ["run", "test:e2e"]],
  ["npm", ["run", "test:lighthouse"]],
  ["git", ["diff", "--check"]],
];

const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE;
const hasAuthState = Boolean(authStatePath && existsSync(authStatePath));
const existingDevServerUrl = "http://localhost:3000";
const authenticatedE2eEnv = { PLAYWRIGHT_E2E_AUTH_BYPASS: "1" };
const failedChecks = [];

if (!hasAuthState) {
  console.warn("Authenticated E2E not fully verified because PLAYWRIGHT_AUTH_STATE is missing.");
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
  failedChecks.push("PLAYWRIGHT_AUTH_STATE missing; authenticated E2E coverage incomplete.");
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
  if (command === "npm" && args.join(" ") === "run test:e2e" && hasAuthState) {
    const reuseExistingDevServer =
      !process.env.PLAYWRIGHT_BASE_URL && (await urlIsReady(`${existingDevServerUrl}/login`));

    if (reuseExistingDevServer) {
      console.warn(`Using existing Playwright base URL at ${existingDevServerUrl}.`);
    }

    return {
      ...process.env,
      ...authenticatedE2eEnv,
      ...(reuseExistingDevServer ? { PLAYWRIGHT_BASE_URL: existingDevServerUrl } : {}),
    };
  }

  if (
    command === "npm" &&
    args.join(" ") === "run test:e2e" &&
    !process.env.PLAYWRIGHT_BASE_URL &&
    (await urlIsReady(`${existingDevServerUrl}/login`))
  ) {
    console.warn(`Using existing Playwright base URL at ${existingDevServerUrl}.`);
    return { ...process.env, PLAYWRIGHT_BASE_URL: existingDevServerUrl };
  }

  return process.env;
}

async function urlIsReady(url) {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return response.status < 500;
  } catch {
    return false;
  }
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
