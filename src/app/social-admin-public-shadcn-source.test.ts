import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isDesktopOnlyCompanionPath,
  isSummaryOnlyCompanionPath,
} from "@/lib/app-route-capabilities";

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

const accountRoutes = [
  "src/app/(app)/profile/page.tsx",
  "src/app/(app)/profile/[username]/page.tsx",
  "src/app/(app)/settings/page.tsx",
] as const;

const socialRoutes = [
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

  it("keeps upgraded account pages on the shared full-width shell", () => {
    for (const route of accountRoutes) {
      const source = read(route);
      expect(source, route).toContain("PageShell");
      expect(source, route).not.toContain("DesktopWorkbenchLayout");
    }
  });

  it("opens known social routes directly without promoting unsupported nested workbenches", () => {
    for (const path of [
      "/feed",
      "/friends",
      "/groups",
      "/groups/example",
      "/billing",
      "/profile",
      "/profile/example",
      "/settings",
    ]) {
      expect(isDesktopOnlyCompanionPath(path), path).toBe(false);
      expect(isSummaryOnlyCompanionPath(path), path).toBe(false);
    }
    expect(isDesktopOnlyCompanionPath("/billing/unsupported")).toBe(true);
    for (const route of socialRoutes) {
      expect(read(route), route).toContain("PageShell");
    }
  });

  it("keeps extracted admin registers on labelled semantic tables", () => {
    const registers = [
      ["src/app/(admin)/admin/page.tsx", "AdminAttention", "src/app/admin/admin-attention.tsx"],
      [
        "src/app/(admin)/admin/system-checks/page.tsx",
        "AdminSystemRegister",
        "src/app/admin/admin-system-register.tsx",
      ],
      [
        "src/app/(admin)/admin/users/page.tsx",
        "AdminUserDirectory",
        "src/app/admin/admin-user-actions.tsx",
      ],
      [
        "src/app/(admin)/admin/moderation/page.tsx",
        "ModerationQueue",
        "src/app/admin/moderation-queue.tsx",
      ],
      [
        "src/app/(admin)/admin/challenges/page.tsx",
        "AdminChallengeBoardRegister",
        "src/app/admin/admin-challenge-board-register.tsx",
      ],
      [
        "src/app/(admin)/admin/billing/page.tsx",
        "AdminBillingLedger",
        "src/app/admin/admin-billing-ledger.tsx",
      ],
    ];
    for (const [route, component, path] of registers) {
      expect(read(route), route).toContain(`<${component}`);
      const source = read(path);
      for (const semantic of ["<table", "<caption", "<thead", "<tbody", 'scope="col"']) {
        expect(source, path).toContain(semantic);
      }
    }
  });

  it("opens admin account detail and requires a reviewed access-removal action", () => {
    const route = read("src/app/(admin)/admin/users/page.tsx");
    const actions = read("src/app/admin/admin-user-actions.tsx");
    const operation = read("src/app/admin/admin-operation-form.tsx");
    expect(route).toContain("<AdminUserDirectory");
    expect(actions).toContain("<ResponsiveDetailPanel");
    expect(actions).toContain('operation="deactivate-admin"');
    expect(actions).toContain(
      "canManageOwners && selected.adminRole && selected.id !== currentUserId",
    );
    expect(operation).toContain("setReview(data)");
    expect(operation).toContain("review !== null");
    expect(operation).toContain("Cancel review");
    expect(operation).toContain("adminFormAction({ ok: false }, review)");
    expect(operation).toContain("if (busy.current) return;");
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
    // The QR image needs its explicit white quiet zone; ordinary app surfaces remain semantic.
    const qr = read("src/app/profile/profile-share-dialog.tsx");
    const qrSurface = '<div className="rounded-xl border bg-white p-4">';
    expect(qr).toContain(qrSurface);
    expect(qr).toContain("alt={`QR code linking to @${username}`}");
    const source = convertedSources.join("\n").replace(qrSurface, "<div>");

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

  it("uses one chronological shadcn Card timeline instead of nested feed cards", () => {
    const feedCards = read("src/components/social/feed-card-list.tsx");
    const feedComposer = read("src/app/feed/status-update-composer.tsx");
    const feedFilters = read("src/app/feed/feed-filter-controls.tsx");
    const friends = read("src/app/(app)/friends/page.tsx");

    expect(feedCards).toContain("data-feed-activity-timeline");
    expect(feedCards).toContain("data-feed-item-id={item.id}");
    expect(feedCards).toContain("groupItemsByDay(items)");
    expect(feedCards).toContain("<FeedActivityRow key={item.id} item={item} />");
    expect(feedCards).not.toContain("<Item");
    expect(feedComposer).toContain("<ResponsiveDetailPanel");
    expect(feedComposer).toContain("<Card");
    expect(feedComposer).toContain("<Alert");
    expect(feedComposer).not.toContain("premium-card p-4");
    expect(feedFilters).toContain('aria-label="Feed filters"');
    expect(feedFilters).toContain('action="/feed"');
    expect(feedFilters).toContain("value={draft.filter}");
    expect(feedFilters).not.toContain("<Tabs");
    expect(feedFilters).toContain("<ResponsiveDetailPanel");
    expect(friends).not.toContain('className="rounded-xl border bg-background p-3"');
  });

  it("consolidates social routes into one active shadcn-controlled surface", () => {
    const friends = read("src/app/(app)/friends/page.tsx");
    const groups = read("src/app/(app)/groups/page.tsx");
    const profile = read("src/app/(app)/profile/page.tsx");

    expect(friends).toContain("<FriendsTabs");
    expect(friends).toContain("<PeopleDirectory");
    expect(friends).not.toContain("CompareWithFriendPanel");
    expect(friends).not.toContain("ProfileList");
    expect(friends).not.toContain("RequestList");
    expect(friends).not.toContain("BlockedList");

    expect(groups).toContain("<GroupDirectoryTabs");
    expect(groups).toContain("activeTab={activeTab}");
    expect(groups).toContain("invites: data.invites.length");
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
    expect(profile).toContain("getAchievementPageData(profile.userId)");
    expect(profile).toContain("getProfileHonoursData(profile.userId)");
    expect(profile).toContain("getProfilePageData(profile.username)");
    expect(profile).toContain("<ProfileSectionTabs");
    expect(profile).not.toContain("Your golf workspaces");
  });

  it("gates destructive social and account actions with explicit confirmation", () => {
    const friendMenu = read("src/app/friends/friend-action-menu.tsx");
    const feedCards = read("src/components/social/feed-card-list.tsx");
    const feedControls = read("src/components/social/feed-item-controls.tsx");
    const profile = read("src/app/(app)/profile/[username]/page.tsx");
    const settings = read("src/app/(app)/settings/page.tsx");

    for (const operation of [
      'decline: "Decline request"',
      'cancel: "Cancel request"',
      'remove: "Remove friend"',
      'block: "Block golfer"',
    ]) {
      expect(friendMenu).toContain(operation);
    }
    expect(friendMenu).toContain("<ResponsiveDetailPanel");
    expect(friendMenu).toContain("Confirm: ${labels[operation]}");
    expect(friendMenu).toContain("if (!operation || busy.current) return;");
    expect(feedCards).toMatch(
      /<FeedActionForm operation="delete-comment">[\s\S]*?<ConfirmSubmitButton[\s\S]*?<\/FeedActionForm>/,
    );
    expect(feedControls).toContain('operation: "delete"');
    expect(feedControls).toContain("<ResponsiveDetailPanel");
    expect(feedControls).toContain("Confirm action");
    expect(feedControls).toContain("if (!choice || lock.current) return;");
    expect(profile).toContain("<PeopleActionMenu");
    expectServerActionFormsToConfirm(settings, "resetGolfDataAction");
    expectServerActionFormsToConfirm(settings, "deleteAccountDataAction");

    const groupDanger = read("src/app/groups/group-danger-actions.tsx");
    expect(groupDanger).toContain("<ResponsiveDetailPanel");
    expect(groupDanger).toContain('"Delete permanently" : "Confirm leave"');
    expect(groupDanger).toContain("if (!isOwner && !isMember) return null;");
    const access = read("src/app/settings/settings-access-actions.tsx");
    expect(access).toContain("<ResponsiveDetailPanel");
    expect(access).toContain("Confirm: ${label}");
    expect(read("src/app/settings/offline-storage-panel.tsx")).toContain("<AlertDialog");
    const billing = read("src/app/billing/billing-manage-dialog.tsx");
    expect(billing).toContain("No subscription change is made here.");
    expect(billing).toContain("Open customer portal");
  });

  it("submits feed interactions directly while reviewing named relationship decisions", () => {
    const feedCards = read("src/components/social/feed-card-list.tsx");
    const feedForm = read("src/components/social/feed-action-form.tsx");
    const friendMenu = read("src/app/friends/friend-action-menu.tsx");
    const groups = read("src/app/(app)/groups/page.tsx");
    expect(feedCards).toContain('operation={item.viewerReacted ? "unreact" : "reaction"}');
    expect(feedCards).toContain('operation="comment" reset');
    expect(feedForm).toContain("feedInteractionFormAction({ ok: false }, data)");
    for (const operation of [
      'accept: "Accept request"',
      'request: "Send friend request"',
      'unblock: "Unblock golfer"',
    ])
      expect(friendMenu).toContain(operation);
    expect(friendMenu).toContain("relationshipFormAction({ ok: false }, form)");
    expect(groups).toContain("<GroupDecision");
    const decision = read("src/app/groups/group-decision.tsx");
    expect(decision).toContain("Review the named group before confirming your decision.");
    expect(decision).toContain("groupMembershipFormAction");
  });

  it("keeps the custom hero, cinematic chapters, real product screens and Course Twin", () => {
    const page = read("src/app/page.tsx");
    const cinematicSections = read("src/components/marketing/cinematic-sections.tsx");
    const cinematicStyles = read("src/components/marketing/cinematic.module.css");
    const mobileMenu = read("src/components/marketing/marketing-mobile-menu.tsx");
    const beta = read("src/components/marketing/beta-access-section.tsx");
    const faq = read("src/components/marketing/marketing-faq.tsx");
    const courseTwin = read("src/components/marketing/course-twin-showcase.tsx");

    expect(page).toContain("<HeroProductStage />");
    expect(page).toContain("<BrandPromise />");
    expect(page).toContain("<LazyCourseTwinShowcase />");
    expect(page).toContain("<PracticeShowcase />");
    expect(page).toContain("<ProductScreensShowcase />");
    expect(page).toContain("<EditorialFeatureGrid />");
    expect(page).toContain("<PrivacyTrustSection />");
    expect(cinematicSections).toContain("product-today.avif");
    expect(cinematicSections).toContain("product-bag.avif");
    expect(cinematicSections).toContain("product-practice.avif");
    expect(cinematicStyles).toContain("[data-marketing-reveal]");
    expect(cinematicStyles).toContain("--scene-y");
    expect(mobileMenu).toContain("<Sheet onOpenChange=");
    expect(beta).toContain("final-green-desktop.avif");
    expect(beta).toContain('data-scroll-pause="beta"');
    expect(faq).toContain("<details");
    expect(faq).toContain("<summary>{item.question}</summary>");
    expect(courseTwin).toContain("<Skeleton");
    expect(courseTwin).toContain("<Alert");
    expect(cinematicStyles).toMatch(/\.finalCtaStage\s*\{[\s\S]*?background:/);
  });
});
