import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ClubArtwork } from "./club-artwork";

describe("club artwork without product metadata", () => {
  it.each([
    ["5i", "5I", "5 iron"],
    ["7 iron", "7I", "7 iron"],
    ["9-iron", "9I", "9 iron"],
    ["pw", "PW", "Pitching wedge"],
    ["pitching wedge", "PW", "Pitching wedge"],
    ["putter", "PT", "Putter"],
    ["4 hybrid", "4H", "4 hybrid"],
  ])("preserves the identity of %s", (clubType, badge, family) => {
    const markup = renderToStaticMarkup(<ClubArtwork clubType={clubType} alt="" />);
    expect(markup).toContain(`>${badge}</text>`);
    expect(markup).toContain(`>${family}</text>`);
  });

  it.each([null, "unknown"])("does not invent an iron for %s", (clubType) => {
    const markup = renderToStaticMarkup(<ClubArtwork clubType={clubType} alt="" />);
    expect(markup).toContain(">Club</text>");
    expect(markup).not.toContain(">Iron</text>");
  });
});
