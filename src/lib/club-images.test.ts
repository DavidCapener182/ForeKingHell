import { describe, expect, it } from "vitest";

import {
  brandPreferredLogoImageUrls,
  brandLogoIconUrls,
  clubArtworkPath,
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
    expect(routePath).toContain("v=9");
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

  it("keeps branded club imagery on the logo resolver", () => {
    const routePath = clubImageRoutePath({
      type: "driver",
      brand: "TaylorMade",
      model: "Qi10",
      fallback: "/assets/clubs/panel/driver-side.png",
    });

    expect(routePath).toContain("brand=TaylorMade");
    expect(routePath).toContain("model=Qi10");
  });

  it.each([
    ["3w", "/assets/clubs/panel/3w-side.png"],
    ["7w", "/assets/clubs/panel/7w-side.png"],
    ["3h", "/assets/clubs/panel/3h-side.png"],
    ["4h", "/assets/clubs/panel/4h-side.png"],
    ["gw", "/assets/clubs/panel/gw-side.png"],
    ["aw", "/assets/clubs/panel/aw-side.png"],
    ["lw", "/assets/clubs/panel/lw-side.png"],
  ])("keeps %s on a distinct fallback artwork path", (clubType, expectedPath) => {
    expect(clubArtworkPath(clubType)).toBe(expectedPath);
  });

  it.each([
    ["3-wood", "/assets/clubs/panel/3w-side.png"],
    ["4 hybrid", "/assets/clubs/panel/4h-side.png"],
    ["approach wedge", "/assets/clubs/panel/aw-side.png"],
  ])("normalizes %s onto the matching club family artwork", (clubType, expectedPath) => {
    expect(clubArtworkPath(clubType)).toBe(expectedPath);
  });
});

function firstLogoDomain(brand: string) {
  const [url] = brandLogoIconUrls(brand);

  return url ? new URL(url).searchParams.get("domain") : null;
}
