import { mkdir } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import nextEnv from "@next/env";

const execFileAsync = promisify(execFile);
const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const port = process.env.LIGHTHOUSE_PORT ?? "3110";
const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? `http://127.0.0.1:${port}`;
const defaultRoutes = ["/", "/login"];
const authenticatedRoutes = [
  "/dashboard",
  "/today",
  "/import",
  "/rapsodo",
  "/providers",
  "/shots",
  "/bag",
  "/progress",
  "/strokes-gained",
  "/compare",
  "/rounds",
  "/courses",
  "/course-records",
  "/practice",
  "/coach",
  "/data-chat",
  "/feed",
];
if (process.env.LIGHTHOUSE_COOKIE || process.env.LIGHTHOUSE_EXTRA_HEADERS_JSON) {
  defaultRoutes.push(...authenticatedRoutes);
}
const routes = (process.env.LIGHTHOUSE_ROUTES ?? defaultRoutes.join(","))
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const outputDir = process.env.LIGHTHOUSE_OUTPUT_DIR ?? "output/lighthouse";
const lighthousePreset = process.env.LIGHTHOUSE_PRESET ?? "";
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
let serverProcess = null;

async function main() {
  await mkdir(outputDir, { recursive: true });

  if (!process.env.LIGHTHOUSE_BASE_URL) {
    serverProcess = spawn("npm", ["run", "start", "--", "-p", port], {
      stdio: ["ignore", "pipe", "pipe"],
      env: localAuditServerEnvironment(),
    });
    serverProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
    serverProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
    await waitFor(`${baseUrl}/login`);
  }

  for (const route of routes) {
    const url = new URL(route, baseUrl).toString();
    const name = route === "/" ? "root" : route.replace(/^\//, "").replace(/[^a-z0-9-]+/gi, "-");
    const args = [
      "lighthouse",
      url,
      "--quiet",
      "--chrome-flags=--headless=new",
      "--only-categories=performance,accessibility,best-practices",
      "--output=html",
      "--output=json",
      `--output-path=${outputDir}/${name}`,
    ];

    if (lighthousePreset) {
      args.push(`--preset=${lighthousePreset}`);
    }

    if (process.env.LIGHTHOUSE_COOKIE) {
      args.push(`--extra-headers=${JSON.stringify({ Cookie: process.env.LIGHTHOUSE_COOKIE })}`);
    } else if (process.env.LIGHTHOUSE_EXTRA_HEADERS_JSON) {
      args.push(`--extra-headers=${process.env.LIGHTHOUSE_EXTRA_HEADERS_JSON}`);
    }

    await runLighthouseAudit(url, args);
    process.stdout.write(`Lighthouse audit written for ${url}\n`);
  }
}

async function runLighthouseAudit(url, args) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await execFileAsync(npxBin, args, { maxBuffer: 1024 * 1024 * 16 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 1) {
        process.stderr.write(`Lighthouse audit failed for ${url}; retrying once.\n`);
      }
    }
  }

  const stderr =
    typeof lastError?.stderr === "string" && lastError.stderr.trim()
      ? `: ${lastError.stderr.trim()}`
      : "";
  throw new Error(`Lighthouse audit failed for ${url}${stderr}`);
}

function localAuditServerEnvironment() {
  return {
    ...process.env,
    DATABASE_URL: configuredValue(
      "DATABASE_URL",
      "postgres://postgres:postgres@127.0.0.1:5432/forekinghell_lighthouse",
    ),
    NEXT_PUBLIC_SITE_URL: configuredValue(
      "NEXT_PUBLIC_SITE_URL",
      "https://lighthouse.example.test",
    ),
    NEXT_PUBLIC_SUPABASE_URL: configuredValue(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://lighthouse-project.supabase.co",
    ),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configuredValue(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "lighthouse-publishable-key",
    ),
    SUPABASE_SERVICE_ROLE_KEY: configuredValue(
      "SUPABASE_SERVICE_ROLE_KEY",
      "lighthouse-service-role-key",
    ),
    SCORECARD_PROOF_SECRET: configuredValue(
      "SCORECARD_PROOF_SECRET",
      "lighthouse-scorecard-proof-secret-32-characters",
    ),
    CRON_SECRET: configuredValue("CRON_SECRET", "lighthouse-cron-secret-32-characters"),
  };
}

function configuredValue(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

async function waitFor(url) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 120_000) {
    try {
      const response = await fetch(url, { redirect: "manual" });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Wait for next start probe.
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });
