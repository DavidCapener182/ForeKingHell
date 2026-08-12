import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { proxy } from "../proxy";

describe("proxy public service endpoints", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const originalBasicAuthPassword = process.env.FKH_BASIC_AUTH_PASSWORD;

  beforeEach(() => {
    delete process.env.FKH_BASIC_AUTH_PASSWORD;
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalSupabaseKey;
    process.env.FKH_BASIC_AUTH_PASSWORD = originalBasicAuthPassword;
  });

  it("lets Stripe reach its signature-authenticated webhook without a user session", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const request = new NextRequest("https://app.example.com/api/stripe/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": "t=1,v1=signature",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("serves the public product landing page without a user session", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const response = await proxy(new NextRequest("https://app.example.com/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("serves only the shared Course Twin assets used by the public demo", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const material = await proxy(
      new NextRequest(
        "https://app.example.com/course-twins/common/materials/Grass001-Color.jpg?v=1",
      ),
    );
    const privateTwin = await proxy(
      new NextRequest("https://app.example.com/course-twins/private-course"),
    );
    const vegetation = await proxy(
      new NextRequest(
        "https://app.example.com/course-twins/common/vegetation/high-detail/tree-oak-hq.webp?v=1",
      ),
    );
    const brand = await proxy(
      new NextRequest("https://app.example.com/brand/lm-world-tour-logo.png"),
    );

    expect(material.status).toBe(200);
    expect(material.headers.get("x-middleware-next")).toBe("1");
    expect(vegetation.status).toBe(200);
    expect(brand.status).toBe(200);
    expect(privateTwin.status).toBe(307);
  });

  it("allows only the configured cron endpoint through the public boundary", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const configured = await proxy(
      new NextRequest("https://app.example.com/api/cron/tour-leaderboards"),
    );
    const unconfigured = await proxy(new NextRequest("https://app.example.com/api/cron/new-job"));

    expect(configured.status).toBe(200);
    expect(unconfigured.status).toBe(401);
    await expect(unconfigured.json()).resolves.toEqual({
      code: "authentication_required",
      message: "Authentication required.",
    });
  });

  it("allows only the exact CSP collector through the public security boundary", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const configured = await proxy(
      new NextRequest("https://app.example.com/api/security/csp-report", { method: "POST" }),
    );
    const unconfigured = await proxy(
      new NextRequest("https://app.example.com/api/security/arbitrary", { method: "POST" }),
    );

    expect(configured.status).toBe(200);
    expect(unconfigured.status).toBe(401);
  });

  it("does not treat arbitrary file-like application paths as public", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const response = await proxy(new NextRequest("https://app.example.com/private/report.csv"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/login?next=%2Fprivate%2Freport.csv",
    );
  });
});

describe("proxy expired-session recovery", () => {
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const originalBasicAuthPassword = process.env.FKH_BASIC_AUTH_PASSWORD;

  beforeEach(() => {
    delete process.env.FKH_BASIC_AUTH_PASSWORD;
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalSupabaseKey;
    process.env.FKH_BASIC_AUTH_PASSWORD = originalBasicAuthPassword;
  });

  it("clears chunked auth and PKCE cookies and preserves the local page query", async () => {
    configureSupabaseAuth();
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockRejectedValue({
          code: "refresh_token_not_found",
          message: "Invalid Refresh Token: Refresh Token Not Found",
        }),
      },
    } as never);
    const request = new NextRequest("https://app.example.com/analyse?club=7i&window=recent", {
      headers: {
        cookie: [
          "sb-project-auth-token.0=broken-a",
          "sb-project-auth-token.1=broken-b",
          "sb-project-auth-token-code-verifier=broken-verifier",
          "theme=clubhouse",
        ].join("; "),
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/login?reason=session_expired&next=%2Fanalyse%3Fclub%3D7i%26window%3Drecent",
    );
    expect(response.cookies.get("sb-project-auth-token.0")?.value).toBe("");
    expect(response.cookies.get("sb-project-auth-token.1")?.value).toBe("");
    expect(response.cookies.get("sb-project-auth-token-code-verifier")?.value).toBe("");
    expect(response.cookies.get("theme")).toBeUndefined();
  });

  it("returns the structured session-expired contract to API callers", async () => {
    configureSupabaseAuth();
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { code: "invalid_refresh_token", message: "Invalid refresh token" },
        }),
      },
    } as never);

    const response = await proxy(
      new NextRequest("https://app.example.com/api/coach/summary", {
        headers: { cookie: "sb-project-auth-token=broken" },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "session_expired",
      message: "Your session has expired. Please sign in again.",
    });
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe("");
  });

  it("does not hide unexpected authentication infrastructure failures", async () => {
    configureSupabaseAuth();
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("Supabase gateway unavailable")),
      },
    } as never);

    await expect(proxy(new NextRequest("https://app.example.com/today"))).rejects.toThrow(
      "Supabase gateway unavailable",
    );
  });
});

describe("proxy legacy phone dashboard recovery", () => {
  const originalBypass = process.env.PLAYWRIGHT_E2E_AUTH_BYPASS;
  const originalBasicAuthPassword = process.env.FKH_BASIC_AUTH_PASSWORD;
  const phoneUserAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  const bypassCookie = "sb-playwright-auth-token=%7B%22access_token%22%3A%22phone-test-token%22%7D";

  beforeEach(() => {
    process.env.PLAYWRIGHT_E2E_AUTH_BYPASS = "1";
    delete process.env.FKH_BASIC_AUTH_PASSWORD;
  });

  afterEach(() => {
    if (originalBypass === undefined) delete process.env.PLAYWRIGHT_E2E_AUTH_BYPASS;
    else process.env.PLAYWRIGHT_E2E_AUTH_BYPASS = originalBypass;

    if (originalBasicAuthPassword === undefined) delete process.env.FKH_BASIC_AUTH_PASSWORD;
    else process.env.FKH_BASIC_AUTH_PASSWORD = originalBasicAuthPassword;
  });

  it("resets an old phone dashboard launch to companion Today", async () => {
    const response = await proxy(
      new NextRequest("https://app.example.com/dashboard", {
        headers: {
          cookie: `${bypassCookie}; fkh-app-surface=workbench`,
          "user-agent": phoneUserAgent,
        },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/today");
    expect(response.cookies.get("fkh-app-surface")?.value).toBe("companion");
  });

  it("leaves explicitly opened phone workbench pages available", async () => {
    const response = await proxy(
      new NextRequest("https://app.example.com/today", {
        headers: {
          cookie: `${bypassCookie}; fkh-app-surface=workbench`,
          "user-agent": phoneUserAgent,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.get("fkh-app-surface")).toBeUndefined();
  });
});

function configureSupabaseAuth() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
}
