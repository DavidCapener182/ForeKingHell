import { expect, test } from "@playwright/test";
import { injectAxe } from "./helpers";

test.skip(
  process.env.PLAYWRIGHT_E2E_AUTH_BYPASS !== "1",
  "Requires authorised local fixture session.",
);
test("P01: shared URL tabs and explicit unavailable comparison across surfaces", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "Explicit viewport matrix.");
  test.setTimeout(240_000);
  const query =
    "compareClub=745445c4-d305-47f0-95a0-f0d02f77421b&compareMeasure=carry&compareFrom=2026-01-01";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const surface of ["workbench", "companion"]) {
    await page.goto(`/surface/${surface}?next=${encodeURIComponent(`/progress?${query}`)}`);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
      { width: 360, height: 800 },
      { width: 1023, height: 800 },
      { width: 1024, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      const tabs = page.getByRole("tablist", { name: "Progress sections" });
      await expect(tabs).toBeVisible();
      await expect(page.locator("[data-progress-tabs]")).toHaveAttribute("data-ready", "true");
      await expect(
        page.getByRole("heading", { level: 1, name: "Progress", exact: true }),
      ).toHaveCount(1);
      await expect(page.locator("[data-progress-comparison]").getByRole("alert")).toContainText(
        "unavailable to this account",
      );
      await tabs.getByRole("tab", {name:"Performance",exact:true}).focus();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.getByRole("tab", {name:"Goals",exact:true})).toBeFocused();
      await page.keyboard.press("Home");
      await expect(tabs.getByRole("tab", {name:"Performance",exact:true})).toBeFocused();
      for (const label of ["Goals", "Load", "Timeline", "Performance"]) {
        await tabs.getByRole("tab", { name: label, exact: true }).click();
        await expect(page.getByRole("tabpanel", { name: label, exact: true })).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`tab=${label.toLowerCase()}`));
        expect(new URL(page.url()).searchParams.get("compareClub")).toBe(
          "745445c4-d305-47f0-95a0-f0d02f77421b",
        );
        expect(new URL(page.url()).searchParams.get("compareMeasure")).toBe("carry");
        await tabs.scrollIntoViewIfNeeded();
        await page.screenshot({path:info.outputPath(`P01-${surface}-${viewport.width}-${label}.png`)});
        if (viewport.width === 1440 || viewport.width === 360) {
          await injectAxe(page);
          const violations = await page.evaluate(async () => {
            const axe = (window as unknown as {axe:{run:(context:string) => Promise<{violations:Array<{id:string;impact:string;nodes:Array<{target:string[]}>}>}>}}).axe;
            return (await axe.run("[data-progress-tabs]")).violations.map(({id,impact,nodes}) => ({id,impact,targets:nodes.map(node => node.target)}));
          });
          expect(violations).toEqual([]);
        }
      }
      await page.goBack();
      await expect(tabs.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.goForward();
      await expect(tabs.getByRole("tab", { name: "Performance", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.reload();
      await expect(tabs.getByRole("tab", { name: "Performance", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.locator("[data-progress-snapshot]")).toContainText(
        "Historical composite scores are not stored",
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow).toBe(false);
      await page.screenshot({ path: info.outputPath(`P01-${surface}-${viewport.width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
