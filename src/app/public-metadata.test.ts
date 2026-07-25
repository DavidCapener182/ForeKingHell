import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("public metadata boundaries", () => {
  it("indexes only public routes", () => {
    expect(sitemap().map((entry) => new URL(entry.url).pathname)).toEqual(["/", "/privacy"]);
  });

  it("keeps account and bearer-token routes out of crawlers", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(false);
    if (Array.isArray(rules)) return;

    expect(rules.disallow).toEqual(
      expect.arrayContaining([
        "/admin/",
        "/dashboard",
        "/data-chat",
        "/share/",
        "/shared/",
        "/login",
      ]),
    );
  });
});
