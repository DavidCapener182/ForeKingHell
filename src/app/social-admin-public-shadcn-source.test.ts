import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function expectServerActionFormsToConfirm(source: string, actionName: string) {
  const matches = [
    ...source.matchAll(
      new RegExp(`<form[^>]*action=\\{${actionName}\\}[^>]*>([\\s\\S]*?)<\\/form>`, "g"),
    ),
  ];

  expect(matches.length, `${actionName} should be rendered by at least one form`).toBeGreaterThan(
    0,
  );
  for (const match of matches) {
    expect(match[1], `${actionName} must be gated by a shadcn confirmation`).toMatch(
      /<(?:ConfirmSubmitButton|AlertDialogAction)/,
    );
  }
}

const summaryCapableRoutes = [
  "src/app/(app)/profile/page.tsx",
  "src/app/(app)/profile/[username]/page.tsx",
  "src/app/(app)/settings/page.tsx",
] as const;

const desktopOnlySocialRoutes = [
  "src/app/(app)/feed/page.tsx",
  "src/app/(app)/friends/page.tsx",
  "src/app/(app)/groups/page.tsx",
  "src/app/(app)/groups/[groupSlug]/page.tsx",
  "src/app/(app)/billing/page.tsx",
] as const;

const adminTableRoutes = [
  "src/app/(admin)/admin/page.tsx",
  "src/app/(admin)/admin/system-checks/page.tsx",
  "src/app/(admin)/admin/users/page.tsx",
  "src/app/(admin)/admin/moderation/page.tsx",
  "src/app/(admin)/admin/challenges/page.tsx",
  "src/app/(admin)/admin/billing/page.tsx",
] as const;

describe("social, account, admin and public shadcn pass", () => {
  it("keeps the existing radix-nova shadcn configuration", () => {
    const config = JSON.parse(read("components.json")) as { style?: string; rsc?: boolean };

    expect(config.style).toBe("radix-nova");
    expect(config.rsc).toBe(true);
  });

  it("keeps summary-capable account requests out of the desktop workbench module graph", () => {
    for (const route of summaryCapableRoutes) {
      const source = read(route);

      expect(source, route).toContain("getRequestAppSurface");
      expect(source, route).toContain('surface === "companion"');
      expect(source, route).toContain('await import("@/components/app/desktop-workbench")');
      expect(source, route).not.toMatch(
        /import\s*\{[\s\S]*?DesktopWorkbenchLayout[\s\S]*?\}\s*from\s*["']@\/components\/app\/desktop-workbench["']/,
      );
    }
  });

  it("keeps desktop-only social routes free of obsolete companion bundles", () => {
    const capabilities = read("src/lib/app-route-capabilities.ts");

    for (const capability of ["groups", "friends", "feed", "billing"]) {
      expect(capabilities).toMatch(new RegExp(`${capability}: desktopOnly\\(`));
    }

    for (const route of desktopOnlySocialRoutes) {
      const source = read(route);

      expect(source, route).toContain("DesktopWorkbenchLayout");
      expect(source, route).not.toContain("getRequestAppSurface");
      expect(source, route).not.toContain('surface === "companion"');
      expect(source, route).not.toMatch(
        /MobileAppShell|MobileTopBar|MobileTabBar|MobileRouteHeader|IOSDisclosure|IOSGroupedList|BottomSheet/,
      );
      expect(source, route).not.toMatch(/from\s+["']@\/components\/app\/ios-mobile["']/);
    }
  });

  it("uses the shadcn Table primitive for every listed admin register", () => {
    for (const route of adminTableRoutes) {
      const source = read(route);

      expect(source, route).toContain('from "@/components/ui/table"');
      expect(source, route).toContain("<Table");
      expect(source, route).not.toMatch(/<(?:table|caption|thead|tbody|tr|th|td)\b/);
      expect(source, route).toContain("<TableHeader");
      expect(source, route).toContain("<TableBody");
    }
  });

  it("opens admin user row detail in a Sheet and confirms access removal", () => {
    const route = read("src/app/(admin)/admin/users/page.tsx");
    const actions = read("src/app/admin/admin-user-actions.tsx");

    expect(route).toContain("<AdminUserActions");
    expect(actions).toContain("<DropdownMenu");
    expect(actions).toContain("<Sheet");
    expect(actions).toContain("<AlertDialog");
    expect(actions).toContain("deactivateAdminAccessAction");
  });

  it("keeps converted surfaces on semantic theme tokens", () => {
    const convertedSources = [
      ...adminTableRoutes,
      "src/app/(app)/feed/page.tsx",
      "src/app/(app)/feed/loading.tsx",
      "src/app/(app)/friends/page.tsx",
      "src/app/(app)/groups/page.tsx",
      "src/app/(app)/groups/[groupSlug]/page.tsx",
      "src/app/(app)/profile/page.tsx",
      "src/app/(app)/profile/[username]/page.tsx",
      "src/app/(app)/settings/page.tsx",
      "src/app/(app)/settings/notifications/page.tsx",
      "src/app/(app)/billing/page.tsx",
      "src/components/social/feed-card-list.tsx",
      "src/components/social/social-avatar.tsx",
      "src/components/social/social-feed-rail.tsx",
      "src/components/social/feed-item-controls.tsx",
      "src/app/feed/feed-filter-controls.tsx",
      "src/app/feed/status-update-composer.tsx",
      "src/app/friends/friend-invite-dialog.tsx",
      "src/app/friends/friend-action-menu.tsx",
      "src/app/groups/group-create-sheet.tsx",
      "src/app/groups/group-danger-actions.tsx",
      "src/app/groups/group-members-dialog.tsx",
      "src/app/groups/group-section-tabs.tsx",
      "src/app/profile/profile-edit-sheet.tsx",
      "src/app/profile/profile-media-editor.tsx",
      "src/app/profile/profile-section-tabs.tsx",
      "src/app/profile/profile-share-dialog.tsx",
      "src/app/settings/offline-storage-panel.tsx",
      "src/app/settings/settings-access-actions.tsx",
      "src/app/settings/settings-dirty-form.tsx",
      "src/app/settings/settings-status-toast.tsx",
      "src/app/billing/billing-manage-dialog.tsx",
      "src/app/admin/admin-user-actions.tsx",
      "src/app/admin/moderation-row-actions.tsx",
      "src/app/admin/admin-challenge-actions.tsx",
      "src/app/admin/admin-billing-actions.tsx",
      "src/components/theme-preference-select.tsx",
      "src/components/marketing/beta-access-section.tsx",
      "src/components/marketing/trust-strip.tsx",
      "src/components/marketing/import-practice-guide.tsx",
      "src/components/marketing/marketing-mobile-menu.tsx",
      "src/components/marketing/sample-product-tour.tsx",
      "src/components/marketing/marketing-faq.tsx",
    ].map(read);
    const source = convertedSources.join("\n");

    for (const hardCodedToken of [
      "bg-white",
      "bg-slate-",
      "text-slate-",
      "border-slate-",
      "ring-slate-",
      "from-slate-",
      "to-slate-",
      "text-sky-",
      "text-emerald-",
      "bg-[#",
      "text-[#",
      "border-[#",
    ]) {
      expect(source).not.toContain(hardCodedToken);
    }

    for (const token of [
      "bg-card",
      "bg-muted",
      "bg-background",
      "text-foreground",
      "text-muted-foreground",
      "text-primary",
      "border-border",
    ]) {
      expect(source).toContain(token);
    }
  });

  it("keeps every product theme available through the shadcn appearance Select", () => {
    const selector = read("src/components/theme-preference-select.tsx");
    const settings = read("src/lib/user-settings.ts");

    expect(selector).toContain("<Select");
    expect(selector).toContain("<SelectItem");
    expect(selector).toContain("themeOptions.map");
    expect(selector).not.toContain('type="radio"');

    for (const theme of [
      "system",
      "light",
      "dark",
      "clubhouse",
      "outdoor",
      "range-night",
      "tour-broadcast",
      "high-contrast",
    ]) {
      expect(settings).toContain(`"${theme}"`);
    }
  });

  it("uses shadcn Items for feed insets instead of hand-built nested card shells", () => {
    const feedCards = read("src/components/social/feed-card-list.tsx");
    const feedComposer = read("src/app/feed/status-update-composer.tsx");
    const feedFilters = read("src/app/feed/feed-filter-controls.tsx");
    const friends = read("src/app/(app)/friends/page.tsx");

    expect(feedCards).toContain('import { Item } from "@/components/ui/item"');
    expect(feedCards).toContain('<Item variant="muted" className="block p-3">');
    expect(feedCards).toMatch(/<Item key=\{item\.id\} variant="outline" className="block p-3">/);
    expect(feedCards).not.toMatch(/rounded-xl border bg-(?:card|background|muted\/35) p-/);
    expect(feedComposer).toContain("<Sheet>");
    expect(feedComposer).toContain("<Card");
    expect(feedComposer).toContain("<Alert");
    expect(feedComposer).not.toContain("premium-card p-4");
    expect(feedFilters).toContain("<Card");
    expect(feedFilters).toContain("<ButtonGroup");
    expect(feedFilters).toContain('aria-current={active ? "page" : undefined}');
    expect(feedFilters).not.toContain("<Tabs");
    expect(feedFilters).toContain("<DropdownMenu");
    expect(friends).not.toContain('className="rounded-xl border bg-background p-3"');
  });

  it("consolidates social routes into one active shadcn-controlled surface", () => {
    const friends = read("src/app/(app)/friends/page.tsx");
    const groups = read("src/app/(app)/groups/page.tsx");
    const profile = read("src/app/(app)/profile/page.tsx");

    expect(friends).toContain("<FriendsTabs");
    expect(friends).toContain("<FriendGraphTable");
    expect(friends).not.toContain("CompareWithFriendPanel");
    expect(friends).not.toContain("ProfileList");
    expect(friends).not.toContain("RequestList");
    expect(friends).not.toContain("BlockedList");

    expect(groups).toContain(
      '<GroupSectionTabs activeSection={activeSection} baseHref="/groups" />',
    );
    expect(groups).not.toContain("GroupBoardFilterTabs");
    expect(groups).not.toContain("function GroupGrid");
    expect(groups).not.toContain("Discoverable leagues");

    expect(profile).not.toContain("<MobileTabBar");
    expect(profile).not.toContain("<PBCard");
    expect(profile).not.toContain("<ProgressCard");
    expect(profile).not.toContain("<DataHealthFeaturePanel");
    expect(profile).not.toContain("<ProfileFeaturePanel");
    expect(profile).not.toContain("getProgressData");
    expect(profile).not.toContain("getFeatureIdeasData");
    expect(profile).toContain(
      "await Promise.all([getChallengesPageData(), getProfileHonoursData(profile.userId)])",
    );
    expect(profile).toContain('title="Golf workspaces"');
  });

  it("gates destructive social and account server actions with shadcn AlertDialogs", () => {
    const friends = read("src/app/(app)/friends/page.tsx");
    const feedCards = read("src/components/social/feed-card-list.tsx");
    const feedControls = read("src/components/social/feed-item-controls.tsx");
    const profile = read("src/app/(app)/profile/[username]/page.tsx");
    const settings = read("src/app/(app)/settings/page.tsx");

    for (const actionName of ["declineFriendRequestAction", "cancelFriendRequestAction"]) {
      expectServerActionFormsToConfirm(friends, actionName);
    }

    const friendMenu = read("src/app/friends/friend-action-menu.tsx");
    for (const actionName of ["removeFriendAction", "blockUserAction"]) {
      expectServerActionFormsToConfirm(friendMenu, actionName);
    }

    expectServerActionFormsToConfirm(feedCards, "deleteFeedCommentAction");
    expectServerActionFormsToConfirm(feedControls, "deleteFeedItemAction");
    expectServerActionFormsToConfirm(profile, "blockUserAction");
    expectServerActionFormsToConfirm(settings, "resetGolfDataAction");
    expectServerActionFormsToConfirm(settings, "deleteAccountDataAction");

    for (const path of [
      "src/app/friends/friend-action-menu.tsx",
      "src/app/groups/group-danger-actions.tsx",
      "src/app/settings/settings-access-actions.tsx",
      "src/app/settings/offline-storage-panel.tsx",
      "src/app/billing/billing-manage-dialog.tsx",
    ]) {
      expect(read(path), path).toContain("<AlertDialog");
    }
  });

  it("keeps non-destructive form submissions direct", () => {
    const feedCards = read("src/components/social/feed-card-list.tsx");
    const friends = read("src/app/(app)/friends/page.tsx");
    const groups = read("src/app/(app)/groups/page.tsx");

    expect(feedCards).toContain("addFeedReactionAction");
    expect(feedCards).toContain("addFeedCommentAction");
    expect(friends).toContain("acceptFriendRequestAction");
    expect(friends).toContain("sendFriendRequestAction");
    expect(friends).toContain("unblockUserAction");
    expect(groups).toContain("joinGroupAction");
  });

  it("adds the public setup guide while preserving custom hero, story and Course Twin", () => {
    const page = read("src/app/page.tsx");
    const lazySections = read("src/components/marketing/lazy-marketing-sections.tsx");
    const guide = read("src/components/marketing/import-practice-guide.tsx");
    const marketingStyles = read("src/components/marketing/marketing.module.css");
    const mobileMenu = read("src/components/marketing/marketing-mobile-menu.tsx");
    const sampleTour = read("src/components/marketing/sample-product-tour.tsx");
    const beta = read("src/components/marketing/beta-access-section.tsx");
    const faq = read("src/components/marketing/marketing-faq.tsx");
    const courseTwin = read("src/components/marketing/course-twin-showcase.tsx");
    const trust = read("src/components/marketing/trust-strip.tsx");

    expect(page).toContain("<HeroProductStage />");
    expect(page).toContain("<LazyScrollProductStory />");
    expect(page).not.toContain('from "@/components/marketing/scroll-product-story"');
    expect(lazySections).toContain('import("@/components/marketing/scroll-product-story")');
    expect(page).toContain("<MarketingStoryNoScript />");
    expect(page).toContain("<noscript>");
    expect(page).toContain("marketingTourSteps.map");
    expect(lazySections).toContain('className="min-h-[44rem]" aria-hidden');
    expect(page).toContain("<LazyCourseTwinShowcase />");
    expect(page).toContain("<ImportPracticeGuide />");
    expect(guide).toContain("<Card");
    expect(guide).toContain("<Item");
    expect(guide).toContain("<Separator");
    expect(guide).toContain("Import → review → practise");
    expect(mobileMenu).toContain("<Sheet>");
    expect(sampleTour).toContain("<Tabs");
    expect(sampleTour).toContain("<TabsContent");
    expect(beta).toContain("<ProviderItem");
    expect(beta).toContain("<Card");
    expect(faq).toContain("<Accordion");
    expect(courseTwin).toContain("<Skeleton");
    expect(courseTwin).toContain("<Alert");
    expect(trust).toContain("<Card");
    expect(trust).toContain("<Separator");
    expect(marketingStyles).toMatch(/\.trustStrip\s*\{[\s\S]*?background:\s*var\(--card\)/);
    expect(marketingStyles).toMatch(/\.betaPanel\s*\{[\s\S]*?background:\s*var\(--card\)/);
  });
});
