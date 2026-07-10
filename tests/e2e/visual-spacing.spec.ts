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
        const audit = await auditViewport(page, viewport.width < 1024);

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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(routePath, { waitUntil: "domcontentloaded", timeout: 60_000 });
      break;
    } catch (error) {
      const retryable = /ERR_ABORTED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|Timeout/i.test(
        String(error),
      );
      if (!retryable || attempt === 1) {
        throw error;
      }
      await page.waitForTimeout(1_000);
    }
  }
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
  await expectPageReady(page, expectedText);
}

async function auditViewport(page: Page, isMobile: boolean) {
  const firstPass = await page.evaluate(() => {
    const issues: string[] = [];
    const viewportWidth = window.innerWidth;
    const horizontalOverflow = document.documentElement.scrollWidth - viewportWidth;

    if (horizontalOverflow > 2) {
      issues.push(`horizontal overflow ${horizontalOverflow}px`);
    }

    for (const media of visibleElements("[data-media-container]")) {
      const isEmpty =
        !media.node.querySelector("img,svg,canvas,picture,video") &&
        (media.node.textContent?.trim().length ?? 0) === 0;
      if (media.rect.height > 24 && isEmpty) {
        issues.push(
          `empty media container ${Math.round(media.rect.width)}x${Math.round(media.rect.height)}`,
        );
      }
    }

    return { issues };

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
  });

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
        const mobileNav = document.querySelector("nav[aria-label='Mobile primary']");
        const fixedBottom = mobileNav
          ? {
              node: mobileNav,
              rect: mobileNav.getBoundingClientRect(),
              style: window.getComputedStyle(mobileNav),
            }
          : null;

        if (!fixedBottom || fixedBottom.style.position !== "fixed") {
          return { issues };
        }

        const fixedTop = fixedBottom.rect.top;
        const lastContent = Array.from(document.querySelectorAll("main *"))
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              node,
              rect,
              visibleBounds: visibleVerticalBounds(node, rect),
              style: window.getComputedStyle(node),
            };
          })
          .filter(({ node, rect, visibleBounds, style }) => {
            const hasMeaningfulContent =
              node.matches(
                "a,button,input,select,textarea,summary,h1,h2,h3,h4,h5,h6,p,li,td,th,img,svg,canvas,video",
              ) || Boolean(node.getAttribute("role")?.match(/button|link|table|img/));
            return (
              style.position !== "fixed" &&
              style.position !== "absolute" &&
              !node.closest("[data-sticky-mobile-action]") &&
              !node.closest("nav") &&
              hasMeaningfulContent &&
              rect.width > 1 &&
              rect.height > 1 &&
              visibleBounds.bottom > visibleBounds.top &&
              visibleBounds.bottom > 0 &&
              visibleBounds.top < window.innerHeight &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) !== 0
            );
          })
          .sort((left, right) => right.visibleBounds.bottom - left.visibleBounds.bottom)[0];

        if (lastContent && lastContent.visibleBounds.bottom > fixedTop - 8) {
          issues.push(
            `bottom fixed navigation overlaps last content by ${Math.round(lastContent.visibleBounds.bottom - fixedTop)}px`,
          );
        }

        return { issues };

        function visibleVerticalBounds(node: Element, rect: DOMRect) {
          let top = rect.top;
          let bottom = rect.bottom;
          let ancestor = node.parentElement;

          while (ancestor && ancestor !== document.body) {
            const ancestorStyle = window.getComputedStyle(ancestor);
            if (["auto", "clip", "hidden", "scroll"].includes(ancestorStyle.overflowY)) {
              const ancestorRect = ancestor.getBoundingClientRect();
              top = Math.max(top, ancestorRect.top);
              bottom = Math.min(bottom, ancestorRect.bottom);
            }
            ancestor = ancestor.parentElement;
          }

          return { top, bottom };
        }
      });
    });

  return { issues: [...firstPass.issues, ...bottomPass.issues] };
}
