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

describe("feed timeline-first composition", () => {
  it("renders exactly one real filtered feed stream without a duplicate ledger", () => {
    expect(source).toContain('<PageShell className="bg-muted/20">');
    expect(source).toContain('<DesktopWorkbenchLayout scope="feed">');
    expect(source).toContain("data-feed-timeline-first");
    expect(source).toContain("const filteredItems = filterFeedItems(");
    expect(source).toContain("buildFeedActivityCsvHref(filteredItems)");
    expect(source.match(/<FeedCardList\b/g)).toHaveLength(1);
    expect(source).toContain("<FeedCardList items={filteredItems} />");

    for (const duplicateSurface of [
      "FeedActivityLedger",
      "DesktopTableWorkbenchControls",
      "DataTableFrame",
      "DataFirstFlowPanel",
      "SocialFeaturePanel",
      "Social pulse",
      "Activity highlights",
      "Network pulse",
      "feedActivityColumns",
      "feedActivitySuggestedViews",
      "getFeatureIdeasData",
      "<Table",
    ]) {
      expect(source).not.toContain(duplicateSurface);
    }
  });

  it("keeps the composer and filters ahead of the chronological stream", () => {
    const composer = source.indexOf('<Card id="create-feed-post"');
    const filters = source.indexOf("<FeedFilterControls");
    const stream = source.indexOf("<FeedCardList items={filteredItems}");

    expect(composer).toBeGreaterThanOrEqual(0);
    expect(filters).toBeGreaterThan(composer);
    expect(stream).toBeGreaterThan(filters);
    expect(source).toContain("<StatusUpdateComposerSheet");
    expect(composerSource).toContain("createStatusUpdateAction");
    expect(composerSource).toContain('name="visibility"');
    expect(composerSource).toContain('name="body"');
    expect(filterSource).toContain("<ButtonGroup");
    expect(filterSource).toContain('aria-current={active ? "page" : undefined}');
    expect(filterSource).not.toContain("<Tabs");
    expect(filterSource).toContain("<DropdownMenu");
  });

  it("exports the currently filtered timeline without restoring a second feed surface", () => {
    expect(source).toContain("exportHref={exportHref}");
    expect(source).toContain("exportItemCount={filteredItems.length}");
    expect(source).toContain("feedActivityExportFileName(activeFilter)");
    expect(filterSource).toContain("data-feed-export-current-view");
    expect(filterSource).toContain("download={exportFileName}");
    expect(filterSource).toContain("Export CSV");
    expect(filterSource).toContain("aria-label={`Export ${exportItemCount}");
    expect(exportSource).toContain('from "@/lib/csv"');
    expect(exportSource).toContain('"Activity"');
    expect(exportSource).toContain('"Privacy"');
    expect(exportSource).toContain('"Engagement"');
    expect(exportSource).toContain('"Action"');

    for (const duplicateSurface of [
      "FeedActivityLedger",
      "feed-activity-ledger",
      "data-workbench-export-table",
      "<Table",
    ]) {
      expect(source).not.toContain(duplicateSurface);
      expect(exportSource).not.toContain(duplicateSurface);
      expect(filterSource).not.toContain(duplicateSurface);
    }
  });

  it("uses one compact Item-based utility rail instead of left and right metric-card walls", () => {
    expect(source).toContain('aria-label="Feed shortcuts and privacy"');
    expect(source).toContain("data-feed-utility-rail");
    expect(source.match(/<aside\b/g)).toHaveLength(1);
    expect(source.match(/<Card\b/g)).toHaveLength(2);
    expect(source).toContain('<Item variant="muted" size="sm">');
    expect(source).toContain("data.profile.feedVisibilityDefault");
    expect(source).toContain("data.publicProfileCount");

    for (const retiredMetric of [
      "MiniStat",
      "PulseRow",
      "BadgeLike",
      "Feed profile shortcuts",
      "Feed social insight rail",
      "Feed XP",
      "Kudos",
    ]) {
      expect(source).not.toContain(retiredMetric);
    }
  });

  it("preserves filter, network onboarding and privacy business rules", () => {
    expect(source).toContain("data.friendCount === 0");
    expect(source).toContain("<AppEmptyState");
    expect(source).toContain('href="/friends"');
    expect(source).toContain('href="/groups"');
    expect(source).toContain('href="/challenges"');
    expect(source).toContain('href="/course-records"');
    expect(source).toContain('href="/tournaments"');
    expect(source).toContain('href="/leaderboard"');
    expect(source).toContain('case "friends"');
    expect(source).toContain('case "me"');
    expect(source).toContain("item.userId === viewerUserId");
  });

  it("keeps page chrome theme-aware", () => {
    expect(source).toContain("bg-muted/20");
    expect(source).toContain('from "@/components/ui/card"');
    expect(source).toContain("text-foreground");
    expect(source).toContain("color-mix(in srgb, var(--foreground) 8%, transparent)");
    expect(source).not.toMatch(
      /\b(?:bg|border|text)-(?:white|slate|emerald|amber|rose|sky)-(?:\d{2,3})(?:\/\d+)?\b/,
    );
    expect(source).not.toMatch(/rgba?\(|(?:bg|border|text|shadow)-\[#/i);
  });

  it("keeps compact feed engagement metadata above the contrast threshold", () => {
    expect(cardSource).toContain('className="text-xs text-muted-foreground"');
    expect(cardSource).toContain("border-primary/20 bg-primary/5");
    expect(cardSource).not.toContain("text-emerald-");
    expect(cardSource).not.toContain("bg-white");
  });

  it("keeps daily digest posts flat inside the digest card", () => {
    const digest =
      cardSource.match(/function FeedDayDigestCard[\s\S]*?function FeedItemCard/)?.[0] ?? "";
    const digestRow =
      cardSource.match(/function FeedDigestItemRow[\s\S]*?function FeedItemContent/)?.[0] ?? "";
    const sharedContent =
      cardSource.match(/function FeedItemContent[\s\S]*?function HighlightRow/)?.[0] ?? "";

    expect(digest).toContain("<FeedDigestItemRow");
    expect(digest).not.toContain("<FeedItemCard");
    expect(digestRow).toContain("<Item");
    expect(digestRow).toContain("data-feed-digest-item-row");
    expect(digestRow).not.toContain("<Card");
    expect(sharedContent).not.toContain("<Card");
    expect(sharedContent).toContain("<CopyShareImageButton");
    expect(sharedContent).toContain("<ReelExportButton");
    expect(sharedContent).toContain("<FeedItemControls");
    expect(sharedContent).toContain("<CommentCard");
    expect(cardSource).toContain("className={buttonVariants");
    expect(cardSource).not.toContain("<CollapsibleTrigger asChild>");
  });
});
