import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/feed/page.tsx"), "utf8");
const cardSource = readFileSync(
  join(process.cwd(), "src/components/social/feed-card-list.tsx"),
  "utf8",
);
const composerSource = readFileSync(
  join(process.cwd(), "src/app/feed/status-update-composer.tsx"),
  "utf8",
);
const filterSource = readFileSync(
  join(process.cwd(), "src/app/feed/feed-filter-controls.tsx"),
  "utf8",
);
const exportSource = readFileSync(join(process.cwd(), "src/app/feed/feed-csv-export.ts"), "utf8");
const socialSource = readFileSync(join(process.cwd(), "src/lib/social.ts"), "utf8");

describe("clubhouse chronological activity feed", () => {
  it("renders one chronological feed without digest or recommendation surfaces", () => {
    expect(source).toContain('<PageShell className="bg-muted/20">');
    expect(source).toContain('<DesktopWorkbenchLayout scope="feed">');
    expect(source).toContain("data-feed-timeline-first");
    expect(source).toContain("Newest first · no suggested posts");
    expect(source.match(/<FeedCardList\b/g)).toHaveLength(1);
    expect(cardSource).toContain("groupItemsByDay(items)");
    expect(cardSource).toContain("data-feed-activity-timeline");

    for (const retiredSurface of [
      "FeedDayDigestCard",
      "Daily activity digest",
      "Individual cards",
      "Activity highlights",
      "Network pulse",
      "FeedActivityLedger",
      "<Table",
    ]) {
      expect(source).not.toContain(retiredSurface);
      expect(cardSource).not.toContain(retiredSurface);
    }
  });

  it("keeps the compact composer in front of the feed and opens the full form in a Sheet", () => {
    const composer = source.indexOf('<Card id="create-feed-post"');
    const filters = source.indexOf("<FeedFilterControls");
    const stream = source.indexOf("<FeedCardList items={filteredItems}");

    expect(composer).toBeGreaterThanOrEqual(0);
    expect(filters).toBeGreaterThan(composer);
    expect(stream).toBeGreaterThan(filters);
    expect(source).toContain("<StatusUpdateComposerSheet");
    expect(composerSource).toContain("<Sheet>");
    expect(composerSource).toContain("<SheetTrigger asChild>");
    expect(composerSource).toContain("createStatusUpdateAction");
    expect(composerSource).toContain('name="visibility"');
    expect(composerSource).toContain('name="body"');
  });

  it("exposes only the four requested network filters in the visible control", () => {
    for (const filter of ["Following", "Friends", "Groups", "Achievements"]) {
      expect(source).toContain(`label: "${filter}"`);
    }

    expect(filterSource).toContain("filters.map");
    expect(filterSource).toContain("<ButtonGroup");
    expect(filterSource).toContain('aria-current={active ? "page" : undefined}');
    expect(filterSource).toContain("<DropdownMenu");
    expect(filterSource).not.toContain("<Tabs");
  });

  it("backs Following and Friends with the real network id sets", () => {
    expect(socialSource).toContain("getFollowingIds(viewerUserId)");
    expect(socialSource).toContain("followingIds,");
    expect(socialSource).toContain("friendIds,");
    expect(source).toContain("followingIds.has(item.userId)");
    expect(source).toContain("friendIds.has(item.userId)");
    expect(source).toContain('item.itemType.startsWith("group_")');
    expect(source).toContain('item.itemType === "achievement_unlock"');
  });

  it("uses a restrained template for every requested activity family", () => {
    for (const label of [
      "Round",
      "Practice",
      "PB",
      "Achievement",
      "Challenge",
      "Course record",
      "Goal",
      "Status update",
    ]) {
      expect(cardSource).toContain(`label: "${label}"`);
    }

    expect(cardSource).toContain("data-activity-template={kind}");
    expect(cardSource).toContain('<ActivityFact label="Score"');
    expect(cardSource).toContain('<ActivityFact label="Course"');
    expect(cardSource).toContain('label="Highlight"');
    expect(cardSource).toContain('<ActivityFact label="Focus"');
    expect(cardSource).toContain('label="Result"');
    expect(cardSource).toContain("<DispersionThumbnail");
    expect(cardSource).toContain("pbClub(item)");
    expect(cardSource).toContain("<VerificationLabel");
  });

  it("uses avatars, dropdown controls, reactions and collapsed comments consistently", () => {
    expect(cardSource).toContain("<SocialAvatar");
    expect(cardSource).toContain("<FeedItemControls");
    expect(cardSource).toContain("addFeedReactionAction");
    expect(cardSource).toContain("removeFeedReactionAction");
    expect(cardSource).toContain("<Collapsible");
    expect(cardSource).toContain("addFeedCommentAction");
    expect(cardSource).toContain('placeholder="Write a comment"');
  });

  it("retains a single compact utility rail and theme-aware surfaces", () => {
    expect(source).toContain('aria-label="Clubhouse network shortcuts"');
    expect(source).toContain("data-feed-utility-rail");
    expect(source.match(/<aside\b/g)).toHaveLength(1);
    expect(source).toContain('<Item variant="muted" size="sm">');
    expect(source).toContain("data.profile.feedVisibilityDefault");
    expect(source).toContain("bg-muted/20");
    expect(cardSource).toContain("bg-primary/5");

    for (const literal of ["bg-white", "text-emerald-", "bg-emerald-", "rgba(", "bg-[#"]) {
      expect(source).not.toContain(literal);
      expect(cardSource).not.toContain(literal);
    }
  });

  it("exports the selected chronological view without adding another feed surface", () => {
    expect(source).toContain("exportHref={exportHref}");
    expect(source).toContain("exportItemCount={filteredItems.length}");
    expect(filterSource).toContain("data-feed-export-current-view");
    expect(filterSource).toContain("download={exportFileName}");
    expect(exportSource).toContain('from "@/lib/csv"');
    expect(exportSource).toContain('"Activity"');
    expect(exportSource).not.toContain("<Table");
  });
});
