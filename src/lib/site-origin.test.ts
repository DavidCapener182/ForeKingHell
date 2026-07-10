import { describe, expect, it } from "vitest";

import { getSiteOrigin } from "@/lib/site-origin";

describe("site origin", () => {
  it("uses the configured canonical origin and strips paths", () => {
    expect(
      getSiteOrigin({
        NEXT_PUBLIC_SITE_URL: "https://app.example.test/some/path",
        NODE_ENV: "production",
      }),
    ).toBe("https://app.example.test");
  });

  it("uses trusted Vercel deployment metadata without reading request hosts", () => {
    expect(
      getSiteOrigin({
        VERCEL_PROJECT_PRODUCTION_URL: "forekinghell.vercel.app",
        NODE_ENV: "production",
      }),
    ).toBe("https://forekinghell.vercel.app");
  });

  it("fails closed in production when no trusted origin is configured", () => {
    expect(() => getSiteOrigin({ NODE_ENV: "production" })).toThrow(
      "trusted Vercel deployment URL",
    );
  });
});
