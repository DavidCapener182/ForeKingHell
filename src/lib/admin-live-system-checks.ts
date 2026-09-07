import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { requireAdminUser } from "@/lib/admin";

export type LiveSystemCheck = {
  id: string;
  label: string;
  state: "passed" | "failed" | "unavailable";
  checkedAt: string;
  durationMs: number;
  detail: string;
};

/** Explicit admin action only. No writes, sign-in attempts, AI requests or object downloads. */
export async function runReadOnlySystemChecks(): Promise<LiveSystemCheck[]> {
  await requireAdminUser();
  const probe = async (
    id: string,
    label: string,
    check: () => Promise<string>,
  ): Promise<LiveSystemCheck> => {
    const started = Date.now();
    try {
      const detail = await check();
      return {
        id,
        label,
        state: "passed",
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        detail,
      };
    } catch {
      // Never persist a provider response, URL, credential, database error or connection string.
      return {
        id,
        label,
        state: "failed",
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        detail: "The read-only probe failed or timed out. Retry to obtain a new result.",
      };
    }
  };
  const unavailable = (id: string, label: string, detail: string): LiveSystemCheck => ({
    id,
    label,
    state: "unavailable",
    checkedAt: new Date().toISOString(),
    durationMs: 0,
    detail,
  });
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let base: URL | null = null;
  try {
    const candidate = new URL(rawUrl || "");
    if (
      (candidate.protocol === "https:" ||
        (candidate.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(candidate.hostname))) &&
      !candidate.username &&
      !candidate.password &&
      !candidate.search &&
      !candidate.hash
    )
      base = candidate;
  } catch {
    /* Unconfigured URLs remain unavailable. */
  }
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const request = async (path: string, key: string, bearer = false) => {
    const response = await fetch(new URL(path, base!), {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { apikey: key, ...(bearer ? { Authorization: `Bearer ${key}` } : {}) },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Probe failed");
    }
    return response.json();
  };
  return Promise.all([
    probe("database-read", "Database read connection", async () => {
      await getDb().transaction(async (tx) => {
        await tx.execute(sql`set local statement_timeout = '5000ms'`);
        await tx.execute(sql`set transaction read only`);
        await tx.execute(sql`select 1 as reachable`);
      });
      return "SELECT 1 completed using the application connection. This does not verify user-level row policies.";
    }),
    base && publicKey
      ? probe("auth-settings", "Auth settings endpoint", async () => {
          const result = await request("/auth/v1/settings", publicKey);
          if (!result || typeof result.external !== "object" || result.external === null)
            throw new Error("Unexpected response");
          return "Public auth settings returned successfully. Sign-in, email delivery and session renewal were not exercised.";
        })
      : unavailable(
          "auth-settings",
          "Auth settings endpoint",
          "A valid Supabase URL and public key are not configured; no request was sent.",
        ),
    base && serviceKey
      ? probe("storage-buckets", "Storage bucket metadata", async () => {
          const result = await request("/storage/v1/bucket", serviceKey, true);
          if (!Array.isArray(result)) throw new Error("Unexpected response");
          return "Bucket metadata was readable with the configured service credential. Uploads, downloads, capacity and user access policies were not tested.";
        })
      : unavailable(
          "storage-buckets",
          "Storage bucket metadata",
          "A valid Supabase URL and service credential are not configured; no request was sent.",
        ),
    unavailable(
      "other-services",
      "Payments, AI and provider sync",
      "No transactional or paid requests were sent. Stored operational evidence remains separate from live service verification.",
    ),
  ]);
}
