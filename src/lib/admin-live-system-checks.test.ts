import { createServer } from "node:http";
const nativeFetch = globalThis.fetch;
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), execute: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/admin", () => ({ requireAdminUser: mocks.admin }));
vi.mock("@/db/client", () => ({
  getDb: () => ({
    transaction: async (run: (tx: unknown) => Promise<unknown>) => run({ execute: mocks.execute }),
  }),
}));
import { runReadOnlySystemChecks } from "./admin-live-system-checks";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ])
    vi.stubEnv(name, "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("does not probe anything before admin authorization", async () => {
  mocks.admin.mockRejectedValue(new Error("Forbidden"));
  await expect(runReadOnlySystemChecks()).rejects.toThrow("Forbidden");
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("distinguishes a real database response from unavailable integrations", async () => {
  const results = await runReadOnlySystemChecks();
  expect(results.map((result) => result.state)).toEqual([
    "passed",
    "unavailable",
    "unavailable",
    "unavailable",
  ]);
  expect(mocks.execute).toHaveBeenCalledTimes(3);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("uses only bounded uncached GETs and never retains credentials or bucket names", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://configured.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "private-public-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-service-key");
  mocks.fetch.mockImplementation(
    async (url: URL) =>
      new Response(
        JSON.stringify(
          url.pathname.includes("settings")
            ? { external: { email: true } }
            : [{ name: "private-bucket" }],
        ),
        { status: 200 },
      ),
  );
  const result = await runReadOnlySystemChecks();
  expect(result.map((entry) => entry.state)).toEqual(["passed", "passed", "passed", "unavailable"]);
  for (const [, init] of mocks.fetch.mock.calls) {
    expect(init).toMatchObject({ method: "GET", cache: "no-store", redirect: "error" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  }
  expect(JSON.stringify(result)).not.toMatch(/private-|configured.example/);
});
it("sanitizes HTTP, timeout and database failures without reporting success", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://configured.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "secret");
  mocks.execute.mockRejectedValue(new Error("postgres://secret"));
  mocks.fetch.mockRejectedValue(new Error("secret provider timeout"));
  const result = await runReadOnlySystemChecks();
  expect(result.slice(0, 2).map((entry) => entry.state)).toEqual(["failed", "failed"]);
  expect(JSON.stringify(result)).not.toContain("secret");
});
it("rejects unexpected success bodies and unsafe configuration URLs", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://configured.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "secret");
  mocks.fetch.mockResolvedValue(new Response('{"message":"not auth settings"}'));
  expect((await runReadOnlySystemChecks())[1].state).toBe("failed");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://external.example");
  mocks.fetch.mockClear();
  expect((await runReadOnlySystemChecks())[1].state).toBe("unavailable");
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it.skipIf(process.env.RUN_REDESIGN_DB_TESTS !== "1")(
  "executes real HTTP GET probes against an isolated synthetic origin",
  async () => {
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify(
          request.url === "/auth/v1/settings"
            ? { external: { email: true } }
            : [{ name: "synthetic-private-name" }],
        ),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing fixture address");
    vi.stubGlobal("fetch", nativeFetch);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${address.port}`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "synthetic");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic");
    try {
      const results = await runReadOnlySystemChecks();
      expect(results.slice(0, 3).every((result) => result.state === "passed")).toBe(true);
      expect(requests.sort()).toEqual(["GET /auth/v1/settings", "GET /storage/v1/bucket"]);
      expect(JSON.stringify(results)).not.toContain("synthetic-private-name");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
);
