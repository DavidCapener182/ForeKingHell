import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PeopleDirectory, type PeopleDirectoryRow } from "./people-directory";
vi.mock("@/app/friends/friend-action-menu", () => ({
  PeopleActionMenu: () => <button>Connection actions</button>,
}));
vi.mock("@/components/premium", () => ({
  DataTableFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
const recommended = {
  id: "synthetic-person",
  status: "suggested",
  section: "recommended",
  profile: {
    userId: "synthetic-person",
    username: "fixture-golfer",
    displayName: "Synthetic golfer",
    avatarUrl: null,
    relationship: "none",
  },
} as PeopleDirectoryRow;
describe("people directory search and accessible groups", () => {
  it("distinguishes no search matches from the independent recommendations", () => {
    const markup = renderToStaticMarkup(
      <PeopleDirectory rows={[recommended]} query="no-match" activeTab="discover" />,
    );
    expect(markup).toContain("No golfers match");
    expect(markup).toContain("Synthetic golfer");
    expect(markup).toContain('role="status"');
  });
  it("reports filtered empty results without claiming the user has no friends", () => {
    const markup = renderToStaticMarkup(
      <PeopleDirectory rows={[]} query="no-match" activeTab="friends" />,
    );
    expect(markup).toContain("No matching golfers");
    expect(markup).not.toContain("No friends yet");
    expect(markup).toContain('href="/friends?tab=friends"');
  });
  it("resolves every labelled-by reference even when group headings are visually omitted", () => {
    const markup = renderToStaticMarkup(
      <PeopleDirectory
        rows={[{ ...recommended, status: "friend" }]}
        query=""
        activeTab="friends"
      />,
    );
    for (const match of markup.matchAll(/aria-labelledby="([^"]+)"/g))
      for (const id of match[1].split(" ")) expect(markup).toContain(`id="${id}"`);
    expect(markup).toContain('aria-label="Friends"');
  });
});
