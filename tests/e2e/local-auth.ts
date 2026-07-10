import type { BrowserContextOptions } from "playwright-core";

type InlineStorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

export function localAuthBypassEnabled(baseURL: string) {
  return (
    process.env.PLAYWRIGHT_E2E_AUTH_BYPASS === "1" &&
    ["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
  );
}

export function createLocalBypassStorageState(baseURL: string): InlineStorageState {
  const url = new URL(baseURL);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      sub: "c0c02d1e-605a-47c5-a023-83a1c0d18195",
      email: "playwright@forekinghell.local",
      user_metadata: { name: "Playwright" },
    }),
    "playwright",
  ].join(".");

  return {
    cookies: [
      {
        name: "sb-playwright-auth-token",
        value: encodeURIComponent(JSON.stringify({ access_token: token })),
        domain: url.hostname,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 60 * 60,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ],
    origins: [],
  };
}
