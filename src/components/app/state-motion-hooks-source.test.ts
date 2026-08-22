import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("authenticated app state motion hooks", () => {
  it("keeps status icons mounted for accessible working-to-result swaps", () => {
    const source = readSource("src/components/app/operation-status.tsx");

    expect(source).toContain('className="t-icon-swap"');
    expect(source).toContain('data-icon="a"');
    expect(source).toContain('data-icon="b"');
    expect(source).toContain('success && "t-success-check"');
    expect(source).toContain('aria-live={status === "error" ? "assertive" : "polite"}');
  });

  it("keeps unread badges mounted while their open state changes", () => {
    for (const path of [
      "src/components/app/workbench/notification-centre.tsx",
      "src/components/social/social-feed-rail.tsx",
    ]) {
      const source = readSource(path);

      expect(source).toContain('className="t-badge');
      expect(source).toContain("t-badge-dot");
      expect(source).toContain("data-open=");
    }

    expect(readSource("src/components/social/social-feed-rail.tsx")).toContain(
      "setBadgeCount(nextCount)",
    );
    expect(readSource("src/components/app/workbench/notification-centre.tsx")).toContain(
      "setBadgeCount(nextUnreadCount)",
    );
  });

  it("uses token-timed toast exits without removing live copy immediately", () => {
    for (const path of [
      "src/components/achievement-notifications.tsx",
      "src/app/rapsodo/rapsodo-sync-client.tsx",
    ]) {
      const source = readSource(path);

      expect(source).toContain("t-toast");
      expect(source).toContain('readMotionDuration("--toast-close", 180)');
      expect(source).toContain('aria-live="polite"');
    }
  });

  it("keeps lazy skeleton and content layers mounted under one persistent boundary", () => {
    for (const path of [
      "src/app/coach/lazy-coach-data-chat-panel.tsx",
      "src/components/progress/lazy-metric-trend-card.tsx",
      "src/app/bag/lazy-bag-simulator.tsx",
    ]) {
      const source = readSource(path);

      expect(source).toContain('className={cn("t-skel", loaded && "is-revealed")}');
      expect(source).toContain("t-skel-skeleton");
      expect(source).toContain('className="t-skel-content" aria-hidden={!loaded} inert={!loaded}');
      expect(source).toMatch(
        /<[A-Z][A-Za-z]+Skeleton hidden=\{loaded\} \/>\s*<div className="t-skel-content"/,
      );
      expect(source).toContain("aria-hidden={hidden}");
      expect(source).toContain("aria-busy={!loaded}");
      expect(source).toContain('role="status"');
      expect(source).toMatch(/useEffect\(\(\) => \{\s*onLoaded\(\);/);
      expect(source).toContain("onLoaded={revealContent}");
      expect(source).toContain("loading: () => null");
      expect(source).not.toContain("is-pulsing");
      expect(source).not.toContain("t-number-pop");
      expect(source).not.toContain("t-reel");
    }
  });

  it("does not fade truth in after Data Chat's thinking state unmounts", () => {
    const source = readSource("src/app/data-chat/data-chat-panel.tsx");

    expect(source).toContain("{isPending ? <AnalystThinking /> : null}");
    expect(source).not.toContain("t-skel-content");
  });

  it("uses restrained, particle-free favourite feedback", () => {
    for (const path of [
      "src/app/courses/course-favourite-button.tsx",
      "src/components/social/feed-card-list.tsx",
      "src/components/social/social-feed-rail.tsx",
    ]) {
      const source = readSource(path);

      expect(source).toContain("t-like");
      expect(source).toContain("data-liked=");
      expect(source).not.toContain("t-like-particles");
    }
  });

  it("keeps changing counts accessible while animating only a decorative copy", () => {
    for (const path of [
      "src/app/sessions/sessions-companion-list.tsx",
      "src/app/admin/admin-bulk-action-submit.tsx",
    ]) {
      const source = readSource(path);

      expect(source).toContain("t-number-pop tabular-nums");
      expect(source).toContain('aria-live="polite"');
      expect(source).toContain('aria-hidden="true"');
      expect(source).toContain('className="sr-only"');
    }
  });

  it("keeps copy, export, and pin state truthful and accessible", () => {
    const copyShare = readSource("src/components/social/copy-share-image-button.tsx");
    const commandPalette = readSource("src/components/app/desktop-command-palette.tsx");
    const workbench = readSource("src/components/app/desktop-workbench-controls.tsx");

    for (const source of [copyShare, commandPalette, workbench]) {
      expect(source).toContain("t-icon-swap");
      expect(source).toContain('data-icon="a"');
      expect(source).toContain('data-icon="b"');
      expect(source).toContain('aria-hidden="true"');
    }

    expect(copyShare).toContain('copyStatus === "failed"');
    expect(copyShare).toContain('aria-live="polite"');
    expect(commandPalette).toContain("aria-pressed={pinned}");
    expect(workbench).toContain("t-text-state");
    expect(workbench).toContain("data-workbench-action-status");
  });
});
