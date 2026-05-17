import { expect, test, type Page } from "@playwright/test";

import { authStorageState, expectPageReady, skipWhenNoAuth } from "./helpers";

test.describe("visual spacing audit", () => {
  test.use(authStorageState ? { storageState: authStorageState } : {});
  test.setTimeout(1_200_000);

  const routes = [
    { name: "dashboard", path: "/dashboard", text: /Dashboard|Today/i },
    { name: "today", path: "/today", text: /Latest Practice Review|Today/i },
    { name: "import", path: "/import", text: /Import|Rapsodo|Upload CSV/i },
    { name: "rapsodo", path: "/rapsodo", text: /Rapsodo|cloud sync/i },
    { name: "shots", path: "/shots", text: /Shot database|Shot explorer/i },
    { name: "bag", path: "/bag", text: /Stock yardages|Gapping ladder|Bag/i },
    { name: "coach", path: "/coach", text: /Coach/i },
    { name: "progress", path: "/progress", text: /Progress/i },
    { name: "rounds", path: "/rounds", text: /Rounds/i },
    { name: "handicap", path: "/handicap", text: /Handicap/i },
    { name: "courses", path: "/courses", text: /Courses/i },
    { name: "course-records", path: "/course-records", text: /Course records|Course Champion/i },
    { name: "challenges", path: "/challenges", text: /Challenges/i },
    { name: "tournaments", path: "/tournaments", text: /Tournaments|Daily, weekly/i },
    { name: "leaderboard", path: "/leaderboard", text: /Leaderboards/i },
    { name: "feed", path: "/feed", text: /Feed/i },
    { name: "friends", path: "/friends", text: /Friends/i },
    { name: "groups", path: "/groups", text: /Groups/i },
    { name: "profile", path: "/profile", text: /Profile|You/i },
    { name: "achievements", path: "/achievements", text: /Achievements/i },
    { name: "equipment", path: "/equipment", text: /Equipment/i },
    { name: "billing", path: "/billing", text: /Pricing|Current plan/i },
    { name: "providers", path: "/providers", text: /Launch monitor providers|Providers/i },
    { name: "settings", path: "/settings", text: /Settings/i },
  ];

  const desktopRoutes = routes.filter((item) =>
    ["dashboard", "today", "shots", "bag", "coach", "rounds", "handicap", "course-records", "challenges", "tournaments", "feed", "providers", "settings"].includes(item.name),
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
});

async function gotoReady(page: Page, routePath: string, expectedText: RegExp | string) {
  await page.goto(routePath, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
  await expectPageReady(page, expectedText);
}

async function auditViewport(page: Page, isMobile: boolean) {
  const firstPass = await page.evaluate(({ mobile }) => {
    const issues: string[] = [];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const horizontalOverflow = document.documentElement.scrollWidth - viewportWidth;

    if (horizontalOverflow > 2) {
      issues.push(`horizontal overflow ${horizontalOverflow}px`);
    }

    if (mobile) {
      const firstActionTop = firstActionPosition();
      if (firstActionTop !== null && firstActionTop > 360) {
        issues.push(`first primary action starts at ${Math.round(firstActionTop)}px`);
      }

      for (const header of visibleElements("main header").slice(0, 2)) {
        if (header.rect.top < 180 && header.rect.height > 180 && !header.node.closest("[data-allow-tall-mobile-header]")) {
          issues.push(`mobile header is ${Math.round(header.rect.height)}px tall`);
        }
      }

      const largestGap = largestVerticalGap();
      if (largestGap.size > 190) {
        issues.push(`blank vertical zone ${Math.round(largestGap.size)}px near y=${Math.round(largestGap.top)}`);
      }

      const visibleTables = visibleElements("table").filter((item) => item.rect.top < viewportHeight);
      if (visibleTables.length > 0) {
        issues.push("full table visible above mobile fold");
      }
    }

    for (const media of visibleElements("[data-media-container]")) {
      if (media.rect.height > 24 && !media.node.querySelector("img,svg,canvas,picture,video")) {
        issues.push(`empty media container ${Math.round(media.rect.width)}x${Math.round(media.rect.height)}`);
      }
    }

    return { issues };

    function firstActionPosition() {
      const preferred = visibleElements("[data-primary-action] a, [data-primary-action] button, a[data-primary-action], button[data-primary-action]")
        .filter((item) => !item.node.closest("nav"));
      const fallback = visibleElements("main a[href], main button")
        .filter((item) => !item.node.closest("nav"))
        .filter((item) => !item.node.closest("summary"))
        .filter((item) => item.rect.height >= 32 && item.rect.width >= 48);
      const candidates = preferred.length > 0 ? preferred : fallback;
      const action = candidates.sort((left, right) => left.rect.top - right.rect.top)[0];
      return action ? action.rect.top : null;
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

    function meaningful(node: Element) {
      const text = node.textContent?.trim() ?? "";
      return text.length > 0 || Boolean(node.querySelector("img,svg,canvas,picture,video,input,select,textarea,button,a"));
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
  }, { mobile: isMobile });

  if (!isMobile) {
    return firstPass;
  }

  const bottomPass = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  }).then(async () => {
    await page.waitForTimeout(100);
    return page.evaluate(() => {
      const issues: string[] = [];
      const fixedBottom = Array.from(document.querySelectorAll("body *"))
        .map((node) => ({ node, rect: node.getBoundingClientRect(), style: window.getComputedStyle(node) }))
        .filter(({ node, rect, style }) => {
          const hasInteractiveNav = Boolean(node.querySelector("a,button")) || node.matches("nav,[data-sticky-mobile-action]");
          return style.position === "fixed" && hasInteractiveNav && rect.height > 36 && window.innerHeight - rect.bottom < 24;
        })
        .sort((left, right) => left.rect.top - right.rect.top)[0];

      if (!fixedBottom) {
        return { issues };
      }

      const fixedTop = fixedBottom.rect.top;
      const lastContent = Array.from(document.querySelectorAll("main article, main section, main [data-slot='card'], main .premium-card"))
        .map((node) => ({ node, rect: node.getBoundingClientRect(), style: window.getComputedStyle(node) }))
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
        issues.push(`bottom fixed navigation overlaps last content by ${Math.round(lastContent.rect.bottom - fixedTop)}px`);
      }

      return { issues };
    });
  });

  return { issues: [...firstPass.issues, ...bottomPass.issues] };
}
