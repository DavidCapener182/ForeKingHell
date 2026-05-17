import { describe, expect, it } from "vitest";

import { brandLogoIconUrls, clubImageRoutePath } from "@/lib/club-images";

describe("club image helpers", () => {
  it("resolves MacGreggor spelling to the MacGregor Golf favicon domain", () => {
    expect(brandLogoIconUrls("MacGreggor")[0]).toContain("domain=macgregorgolf.com");
  });

  it.each([
    ["Taylor Made", "taylormadegolf.com"],
    ["MacGreoor", "macgregorgolf.com"],
    ["Titlest", "titleist.com"],
    ["Titleist", "titleist.com"],
    ["Cobra Golf", "cobragolf.com"],
    ["PING", "ping.com"],
  ])("resolves %s to %s", (brand, domain) => {
    expect(firstLogoDomain(brand)).toBe(domain);
  });

  it("derives favicon candidates from user-entered brand names", () => {
    expect(brandLogoIconUrls("Example Golf Co.").join(" ")).toContain("examplecogolf.com");
  });

  it("routes branded clubs through the club image resolver", () => {
    expect(
      clubImageRoutePath({
        type: "sw",
        brand: "MacGreggor",
        model: "Sand Wedge",
        fallback: "/assets/clubs/panel/sw-side.png",
      }),
    ).toContain("/api/club-images?");
  });
});

function firstLogoDomain(brand: string) {
  const [url] = brandLogoIconUrls(brand);

  return url ? new URL(url).searchParams.get("domain") : null;
}
