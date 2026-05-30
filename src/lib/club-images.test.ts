import { describe, expect, it } from "vitest";

import {
  brandPreferredLogoImageUrls,
  brandLogoIconUrls,
  buildClubProductImageSearchQuery,
  clubImageRoutePath,
  rankBrandLogoSearchCandidates,
} from "@/lib/club-images";

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
    const routePath = clubImageRoutePath({
      type: "7i",
      brand: "PING",
      model: "i530",
      fallback: "/assets/clubs/panel/7i-side.png",
    });

    expect(routePath).toContain("/api/club-images?");
    expect(routePath).toContain("brand=PING");
    expect(routePath).toContain("model=i530");
    expect(routePath).toContain("v=4");
  });

  it("uses a wordmark logo override for Titleist spelling variants", () => {
    expect(brandPreferredLogoImageUrls("Titlest")[0]).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/7/70/Titleist_logo.svg",
    );
    expect(brandPreferredLogoImageUrls("Titleist")[0]).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/7/70/Titleist_logo.svg",
    );
  });

  it("prefers logo-like brand search results over product photography", () => {
    const ranked = rankBrandLogoSearchCandidates(
      [
        {
          url: "https://example.com/images/titleist-pro-v1-ball.jpg",
          title: "Titleist Pro V1 golf balls",
          displayLink: "example.com",
          contextLink: "https://example.com/titleist-pro-v1",
          mime: "image/jpeg",
          source: "image",
        },
        {
          url: "https://upload.wikimedia.org/wikipedia/commons/7/70/Titleist_logo.svg",
          title: "Titleist logo.svg",
          displayLink: "upload.wikimedia.org",
          contextLink: "https://commons.wikimedia.org/wiki/File:Titleist_logo.svg",
          mime: "image/svg+xml",
          source: "image",
        },
      ],
      "Titleist",
    );

    expect(ranked[0]?.url).toContain("Titleist_logo.svg");
    expect(ranked.map((candidate) => candidate.url)).not.toContain(
      "https://example.com/images/titleist-pro-v1-ball.jpg",
    );
  });

  it("builds a product image query from brand, model, and club", () => {
    expect(
      buildClubProductImageSearchQuery({
        type: "driver",
        brand: "TaylorMade",
        model: "Qi10",
      }),
    ).toBe("TaylorMade Qi10 driver golf club product image");
  });

  it("expands compact iron and wedge club codes for product search", () => {
    expect(
      buildClubProductImageSearchQuery({
        type: "6i",
        brand: "TaylorMade",
        model: "Qi",
      }),
    ).toBe("TaylorMade Qi 6 iron golf club product image");

    expect(
      buildClubProductImageSearchQuery({
        type: "sw",
        brand: "MacGreggor",
        model: "Sand Wedge",
      }),
    ).toBe("MacGreggor Sand Wedge sand wedge golf club product image");
  });

  it("uses the supplied user club brand and model for non-TaylorMade products", () => {
    expect(
      buildClubProductImageSearchQuery({
        type: "7i",
        brand: "PING",
        model: "i530",
      }),
    ).toBe("PING i530 7 iron golf club product image");

    expect(
      buildClubProductImageSearchQuery({
        type: "driver",
        brand: "Titleist",
        model: "GT3",
      }),
    ).toBe("Titleist GT3 driver golf club product image");
  });
});

function firstLogoDomain(brand: string) {
  const [url] = brandLogoIconUrls(brand);

  return url ? new URL(url).searchParams.get("domain") : null;
}
