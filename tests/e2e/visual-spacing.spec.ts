import { expect, test, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("visual spacing audit", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(1_200_000);

  const routes = [
    { name: "dashboard", path: "/dashboard", text: /Dashboard|Today/i },
    { name: "today", path: "/today", text: /Latest Practice Review|Today/i },
    { name: "import", path: "/import", text: /Import|Rapsodo|Upload CSV/i },
    { name: "rapsodo", path: "/rapsodo", text: /Rapsodo Inbox|cloud sync/i },
    { name: "shots", path: "/shots", text: /Your shots|Shot explorer/i },
    { name: "bag", path: "/bag", text: /Bag health|Bag confidence ladder|Bag score trend/i },
    { name: "bag-longest", path: "/bag/longest", text: /Longest/i },
    { name: "simulator-lab", path: "/simulator-lab", text: /Performance Lab/i },
    { name: "compare", path: "/compare", text: /Compare/i },
    { name: "speed", path: "/speed", text: /Speed Centre|Athletic speed/i },
    { name: "training-load", path: "/stats/training-over-time", text: /Training Load/i },
    { name: "coach", path: "/coach", text: /Coach/i },
    { name: "coach-diagnosis", path: "/coach/diagnosis", text: /Diagnosis|Coach/i },
    { name: "practice", path: "/practice", text: /Practice Planner|start-line/i },
    { name: "data-chat", path: "/data-chat", text: /Data Chat/i },
    { name: "progress", path: "/progress", text: /Progress/i },
    { name: "strokes-gained", path: "/strokes-gained", text: /Strokes gained/i },
    { name: "rounds", path: "/rounds", text: /Rounds/i },
    { name: "rounds-new", path: "/rounds/new", text: /New round|Add round/i },
    { name: "handicap", path: "/handicap", text: /Handicap/i },
    { name: "courses", path: "/courses", text: /Courses/i },
    { name: "courses-new", path: "/courses/new", text: /New course|Add course/i },
    { name: "course-records", path: "/course-records", text: /Course records|Course Champion/i },
    { name: "challenges", path: "/challenges", text: /Challenges/i },
    { name: "tournaments", path: "/tournaments", text: /Tournaments|Daily, weekly/i },
    { name: "leaderboard", path: "/leaderboard", text: /Leaderboards/i },
    { name: "feed", path: "/feed", text: /Feed/i },
    { name: "friends", path: "/friends", text: /Friends/i },
    { name: "groups", path: "/groups", text: /Groups/i },
    { name: "profile", path: "/profile", text: /Profile|You/i },
    { name: "social-intelligence", path: "/social-intelligence", text: /Recaps|Safety/i },
    { name: "achievements", path: "/achievements", text: /Achievements/i },
    { name: "equipment", path: "/equipment", text: /Equipment/i },
    { name: "billing", path: "/billing", text: /Pricing|Current plan/i },
    { name: "providers", path: "/providers", text: /Launch monitor providers|Providers/i },
    { name: "settings", path: "/settings", text: /Settings/i },
    // Representative linked detail/setup states from the seeded member workspace.
    { name: "bag-club-detail", path: "/bag/club-8i", text: /Club|Bag|8i/i },
    { name: "bag-club-analytics", path: "/bag/club-8i/analytics", text: /Analytics|Club|8i/i },
    { name: "round-detail", path: "/rounds/round-winter", text: /Round|Winter|Saved rounds/i },
    { name: "course-holes", path: "/courses/course-aintree/holes", text: /Aintree|Holes|Course/i },
    {
      name: "course-shot-pattern",
      path: "/courses/course-aintree/shot-pattern",
      text: /Aintree|Shot pattern|Course/i,
    },
    {
      name: "course-records-detail",
      path: "/courses/course-aintree/records",
      text: /Aintree|Course records|Records/i,
    },
    {
      name: "challenge-detail",
      path: "/challenges/challenge-1",
      text: /Challenge|Leaderboard|Target/i,
    },
    { name: "profile-detail", path: "/profile/alex-smith", text: /Profile|Alex|You/i },
  ];

  const desktopRoutes = routes;

  const familyRoutes = routes.filter((item) =>
    ["dashboard", "practice", "bag", "rounds", "courses", "friends", "settings"].includes(
      item.name,
    ),
  );

  test("all target routes have controlled mobile and desktop spacing", async ({ page }) => {
    skipWhenNoAuth();
    const failures: string[] = [];

    for (const route of routes) {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoReady(page, route.path, route.text);

      const audit = await auditViewport(page, true);
      if (audit.issues.length > 0) {
        failures.push(`${route.name} mobile: ${audit.issues.join("; ")}`);
      }
    }

    for (const route of desktopRoutes) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoReady(page, route.path, route.text);

      const audit = await auditViewport(page, false);
      if (audit.issues.length > 0) {
        failures.push(`${route.name} desktop: ${audit.issues.join("; ")}`);
      }
    }

    expect(failures).toEqual([]);
  });

  test("route families fit phone, tablet, laptop and ultrawide canvases", async ({ page }) => {
    skipWhenNoAuth();
    const failures: string[] = [];
    const viewports = [
      { width: 320, height: 568 },
      { width: 430, height: 932 },
      { width: 744, height: 1133 },
      { width: 1024, height: 768 },
      { width: 1728, height: 1117 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      for (const route of familyRoutes) {
        await gotoReady(page, route.path, route.text);
        const audit = await auditViewport(page, viewport.width < 640);

        if (audit.issues.length > 0) {
          failures.push(
            `${route.name} ${viewport.width}x${viewport.height}: ${audit.issues.join("; ")}`,
          );
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

async function gotoReady(page: Page, routePath: string, expectedText: RegExp | string) {
  await page.goto(routePath, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
  await expectPageReady(page, expectedText);
}

async function auditViewport(page: Page, isMobile: boolean) {
  const firstPass = await page.evaluate(
    ({ mobile }) => {
      const issues: string[] = [];
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const horizontalOverflow = document.documentElement.scrollWidth - viewportWidth;

      if (horizontalOverflow > 2) {
        issues.push(`horizontal overflow ${horizontalOverflow}px`);
      }

      if (mobile) {
        const firstAction = firstActionPosition();
        const firstActionLimit = Math.min(viewportHeight - 48, 360);
        if (
          firstAction !== null &&
          firstAction.top > firstActionLimit &&
          !firstAction.viewportPinned
        ) {
          issues.push(`first primary action starts at ${Math.round(firstAction.top)}px`);
        }

        for (const header of visibleElements("main header").slice(0, 2)) {
          if (
            header.rect.top < 180 &&
            header.rect.height > 180 &&
            !header.node.closest("[data-allow-tall-mobile-header]")
          ) {
            issues.push(`mobile header is ${Math.round(header.rect.height)}px tall`);
          }
        }

        const largestGap = largestVerticalGap();
        if (largestGap.size > 160 && !document.body.closest("[data-allow-mobile-blank-zone]")) {
          issues.push(
            `blank vertical zone ${Math.round(largestGap.size)}px near y=${Math.round(largestGap.top)}`,
          );
        }

        for (const gap of sectionGaps()) {
          if (gap.size > 40) {
            issues.push(`section gap ${Math.round(gap.size)}px near y=${Math.round(gap.top)}`);
          }
        }

        for (const card of sparseTallCards()) {
          issues.push(
            `sparse tall card ${Math.round(card.width)}x${Math.round(card.height)} near y=${Math.round(card.top)}`,
          );
        }

        for (const media of visibleElements("[data-media-container]").filter(
          (item) => item.rect.top < viewportHeight,
        )) {
          if (isEmptyMedia(media.node) && media.rect.height > 96) {
            issues.push(
              `empty mobile media ${Math.round(media.rect.width)}x${Math.round(media.rect.height)} near y=${Math.round(media.rect.top)}`,
            );
          }

          if (media.rect.height > 240 && !media.node.closest("[data-allow-large-mobile-media]")) {
            issues.push(
              `large mobile media ${Math.round(media.rect.width)}x${Math.round(media.rect.height)} near y=${Math.round(media.rect.top)}`,
            );
          }
        }

        for (const rail of emptyReservedRails()) {
          issues.push(
            `empty card rail reserves ${Math.round(rail.width)}x${Math.round(rail.height)} near y=${Math.round(rail.top)}`,
          );
        }

        for (const repeated of repeatedStackedCtas()) {
          issues.push(`repeated stacked CTA ${repeated.label} -> ${repeated.href}`);
        }

        const visibleTables = visibleElements("table").filter(
          (item) => item.rect.top < viewportHeight,
        );
        if (visibleTables.length > 0) {
          issues.push("full table visible above mobile fold");
        }
      } else {
        for (const card of sparseDesktopCards()) {
          issues.push(
            `desktop card reserves ${Math.round(card.unused)}px blank space near y=${Math.round(card.top)}`,
          );
        }

        for (const row of unevenDesktopRows()) {
          issues.push(
            `desktop row ends ${Math.round(row.difference)}px apart near y=${Math.round(row.top)}`,
          );
        }
      }

      for (const media of visibleElements("[data-media-container]")) {
        if (media.rect.height > 24 && isEmptyMedia(media.node)) {
          issues.push(
            `empty media container ${Math.round(media.rect.width)}x${Math.round(media.rect.height)}`,
          );
        }
      }

      return { issues };

      function firstActionPosition() {
        const preferred = visibleElements(
          "[data-primary-action] a, [data-primary-action] button, a[data-primary-action], button[data-primary-action]",
        ).filter((item) => !item.node.closest("nav"));
        const fallback = visibleElements("main a[href], main button")
          .filter((item) => !item.node.closest("nav"))
          .filter((item) => !item.node.closest("summary"))
          .filter((item) => item.rect.height >= 32 && item.rect.width >= 48);
        const candidates = preferred.length > 0 ? preferred : fallback;
        const action = candidates.sort((left, right) => left.rect.top - right.rect.top)[0];
        if (!action) {
          return null;
        }

        const stickyContainer = action.node.closest("[data-sticky-mobile-action]");
        const stickyRect = stickyContainer?.getBoundingClientRect();
        const stickyStyle = stickyContainer ? window.getComputedStyle(stickyContainer) : null;

        return {
          top: action.rect.top,
          viewportPinned: Boolean(
            stickyRect &&
            stickyStyle?.position === "fixed" &&
            stickyRect.top >= 0 &&
            stickyRect.bottom <= viewportHeight,
          ),
        };
      }

      function sparseDesktopCards() {
        return visibleElements("main [data-slot='card'], main .premium-card")
          .filter((item) => item.rect.top < Math.min(1400, viewportHeight + 500))
          .filter((item) => item.rect.height > 280)
          .filter((item) => !item.node.closest("[data-allow-tall-desktop-card]"))
          .filter((item) => !item.node.querySelector("img,canvas,video,[data-media-container]"))
          .map((item) => {
            const childBottom = Array.from(item.node.children)
              .map((child) => ({ child, rect: child.getBoundingClientRect() }))
              .filter(({ child, rect }) => {
                const style = window.getComputedStyle(child);
                return rect.height > 1 && style.position !== "absolute" && style.display !== "none";
              })
              .reduce((bottom, child) => Math.max(bottom, child.rect.bottom), item.rect.top);

            return {
              top: item.rect.top,
              unused: item.rect.bottom - childBottom,
            };
          })
          .filter((item) => item.unused > 120);
      }

      function unevenDesktopRows() {
        const candidates = visibleElements("main .grid")
          .filter((item) => item.rect.top < Math.min(1800, viewportHeight + 900))
          .filter((item) => !item.node.closest("[data-allow-uneven-grid]"))
          .flatMap((item) => {
            const children = Array.from(item.node.children)
              .map((node) => ({ node, rect: node.getBoundingClientRect() }))
              .filter(({ node, rect }) => {
                const style = window.getComputedStyle(node);
                return (
                  rect.width >= 140 &&
                  rect.height >= 72 &&
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  style.position !== "absolute"
                );
              });

            const rows = new Map<number, typeof children>();
            for (const child of children) {
              const rowTop = Math.round(child.rect.top / 8) * 8;
              rows.set(rowTop, [...(rows.get(rowTop) ?? []), child]);
            }

            return Array.from(rows.entries())
              .filter(([, row]) => row.length >= 2)
              .map(([top, row]) => {
                const bottoms = row.map((child) => child.rect.bottom);
                return {
                  top,
                  difference: Math.max(...bottoms) - Math.min(...bottoms),
                };
              })
              .filter((row) => row.difference > 96);
          })
          .sort((left, right) => left.top - right.top || right.difference - left.difference);

        return candidates.filter(
          (candidate, index) =>
            !candidates
              .slice(0, index)
              .some((earlier) => Math.abs(earlier.top - candidate.top) < 16),
        );
      }

      function largestVerticalGap() {
        const maxY = Math.min(1000, viewportHeight + 180);
        const intervals = visibleElements("main *")
          .filter((item) => item.rect.top < maxY && item.rect.bottom > 0)
          .filter((item) => item.rect.height >= 8 && item.rect.width >= 24)
          .filter((item) => {
            const style = window.getComputedStyle(item.node);
            return style.position !== "fixed" && style.position !== "absolute";
          })
          .filter((item) => meaningful(item.node))
          .map((item) => ({
            top: Math.max(0, item.rect.top),
            bottom: Math.min(maxY, item.rect.bottom),
          }))
          .sort((left, right) => left.top - right.top);

        let cursor = 0;
        let largest = { top: 0, size: 0 };

        for (const interval of intervals) {
          if (interval.top - cursor > largest.size) {
            largest = { top: cursor, size: interval.top - cursor };
          }
          cursor = Math.max(cursor, interval.bottom);
        }

        if (maxY - cursor > largest.size) {
          largest = { top: cursor, size: maxY - cursor };
        }

        return largest;
      }

      function sectionGaps() {
        const wrappers = Array.from(document.querySelectorAll("main > div, main"));
        const gaps: Array<{ top: number; size: number }> = [];

        for (const wrapper of wrappers) {
          const items = Array.from(wrapper.children)
            .map((node) => ({ node, rect: node.getBoundingClientRect() }))
            .filter(({ node, rect }) => {
              const style = window.getComputedStyle(node);
              return (
                rect.width > 8 &&
                rect.height > 8 &&
                rect.top < viewportHeight + 180 &&
                rect.bottom > 0 &&
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.position !== "fixed" &&
                !node.closest("[data-allow-large-section-gap]")
              );
            })
            .sort((left, right) => left.rect.top - right.rect.top);

          for (let index = 1; index < items.length; index += 1) {
            const previous = items[index - 1];
            const current = items[index];
            const gap = current.rect.top - previous.rect.bottom;
            if (gap > 0) {
              gaps.push({ top: previous.rect.bottom, size: gap });
            }
          }
        }

        return gaps;
      }

      function sparseTallCards() {
        return visibleElements("main [data-slot='card'], main .premium-card")
          .filter((item) => item.rect.top < viewportHeight)
          .filter((item) => !item.node.closest("[data-allow-tall-mobile-card]"))
          .filter((item) => item.rect.height > 260)
          .filter((item) => {
            const text = item.node.textContent?.replace(/\s+/g, " ").trim() ?? "";
            const richContentCount = item.node.querySelectorAll(
              "img,svg,canvas,picture,video,table,input,select,textarea,button,a",
            ).length;
            return text.length < 90 && richContentCount < 3;
          })
          .map((item) => ({
            top: item.rect.top,
            width: item.rect.width,
            height: item.rect.height,
          }));
      }

      function repeatedStackedCtas() {
        const actions = visibleElements("main a[href], main button")
          .filter((item) => !item.node.closest("nav"))
          .filter((item) => item.rect.top < viewportHeight)
          .filter((item) => item.rect.height >= 32 && item.rect.width >= 48)
          .map((item) => {
            const link = item.node.closest("a[href]") as HTMLAnchorElement | null;
            const label = item.node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
            return {
              href: link?.getAttribute("href") ?? "",
              label,
              top: item.rect.top,
              bottom: item.rect.bottom,
            };
          })
          .filter((item) => item.href || item.label);

        const repeated: Array<{ href: string; label: string }> = [];
        for (let index = 1; index < actions.length; index += 1) {
          const previous = actions[index - 1];
          const current = actions[index];
          if (
            current.top - previous.bottom < 96 &&
            current.href === previous.href &&
            current.label === previous.label &&
            !current.label.match(/^(menu|filter|close|open navigation)$/)
          ) {
            repeated.push({ href: current.href, label: current.label });
          }
        }

        return repeated;
      }

      function emptyReservedRails() {
        return visibleElements("main [data-mobile-rail], main [class*='overflow-x-auto']")
          .filter((item) => item.rect.top < viewportHeight)
          .filter((item) => item.rect.height > 80 && item.rect.width > 160)
          .filter((item) => !item.node.closest("[data-allow-empty-rail]"))
          .filter((item) => {
            const children = Array.from(item.node.children).filter((child) => {
              const rect = child.getBoundingClientRect();
              const style = window.getComputedStyle(child);
              return (
                rect.width > 12 &&
                rect.height > 12 &&
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                meaningful(child)
              );
            });
            return children.length === 0;
          })
          .map((item) => ({
            top: item.rect.top,
            width: item.rect.width,
            height: item.rect.height,
          }));
      }

      function isEmptyMedia(node: Element) {
        return (
          !node.querySelector("img,svg,canvas,picture,video") &&
          (node.textContent?.trim().length ?? 0) === 0
        );
      }

      function meaningful(node: Element) {
        const text = node.textContent?.trim() ?? "";
        return (
          text.length > 0 ||
          Boolean(node.querySelector("img,svg,canvas,picture,video,input,select,textarea,button,a"))
        );
      }

      function visibleElements(selector: string) {
        return Array.from(document.querySelectorAll(selector))
          .map((node) => ({ node, rect: node.getBoundingClientRect() }))
          .filter(({ node, rect }) => {
            const style = window.getComputedStyle(node);
            return (
              rect.width > 1 &&
              rect.height > 1 &&
              rect.bottom > 0 &&
              rect.right > 0 &&
              rect.left < viewportWidth &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) !== 0
            );
          });
      }
    },
    { mobile: isMobile },
  );

  if (!isMobile) {
    return firstPass;
  }

  const bottomPass = await page
    .evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    })
    .then(async () => {
      await page.waitForTimeout(100);
      return page.evaluate(() => {
        const issues: string[] = [];
        const fixedBottom = Array.from(document.querySelectorAll("body *"))
          .map((node) => ({
            node,
            rect: node.getBoundingClientRect(),
            style: window.getComputedStyle(node),
          }))
          .filter(({ node, rect, style }) => {
            const hasInteractiveNav =
              Boolean(node.querySelector("a,button")) ||
              node.matches("nav,[data-sticky-mobile-action]");
            return (
              style.position === "fixed" &&
              hasInteractiveNav &&
              rect.height > 36 &&
              window.innerHeight - rect.bottom < 24
            );
          })
          .sort((left, right) => left.rect.top - right.rect.top)[0];

        if (!fixedBottom) {
          return { issues };
        }

        const fixedTop = fixedBottom.rect.top;
        const lastContent = Array.from(
          document.querySelectorAll(
            "main article, main section, main [data-slot='card'], main .premium-card",
          ),
        )
          .map((node) => ({
            node,
            rect: node.getBoundingClientRect(),
            style: window.getComputedStyle(node),
          }))
          .filter(({ node, rect, style }) => {
            const reservedBottom = parseFloat(style.marginBottom) + parseFloat(style.paddingBottom);
            return (
              style.position !== "fixed" &&
              !node.closest("[data-sticky-mobile-action]") &&
              rect.height > 24 &&
              rect.bottom > 0 &&
              rect.top < window.innerHeight &&
              reservedBottom < 96
            );
          })
          .sort((left, right) => right.rect.bottom - left.rect.bottom)[0];

        if (lastContent && lastContent.rect.bottom > fixedTop - 8) {
          issues.push(
            `bottom fixed navigation overlaps last content by ${Math.round(lastContent.rect.bottom - fixedTop)}px`,
          );
        }

        return { issues };
      });
    });

  return { issues: [...firstPass.issues, ...bottomPass.issues] };
}
