import { expect, test } from "@playwright/test";
import { hasLocalAuthBypass } from "./helpers";

test("highlights travel through intermediate positions and pause reliably", async ({
  page,
}, info) => {
  test.skip(!hasLocalAuthBypass, "Requires local synthetic session data.");
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/surface/workbench?next=%2Fbag%2Flongest");
  const carousel = page.locator("[data-highlight-carousel]").first();
  await expect(carousel.getByRole("button", { name: "Pause highlight rotation" })).toBeEnabled();
  await carousel.scrollIntoViewIfNeeded();
  const evidence = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const previous = await carousel.getAttribute("data-active-slide");
    const framesPromise = carousel.locator('[data-slot="carousel-content"] > div').evaluate(
      (track) =>
        new Promise<number[]>((resolve) => {
          const positions: number[] = [];
          const start = performance.now();
          const frame = () => {
            positions.push(new DOMMatrixReadOnly(getComputedStyle(track).transform).m41);
            if (performance.now() - start < 1800) requestAnimationFrame(frame);
            else resolve(positions);
          };
          requestAnimationFrame(frame);
        }),
    );
    await carousel.getByRole("button", { name: "Next highlight", exact: true }).click();
    const frames = await framesPromise;
    await expect(carousel).not.toHaveAttribute("data-active-slide", previous!);
    const distinctPositions = new Set(frames.map((value) => Math.round(value)));
    expect(
      distinctPositions.size,
      "must visibly slide, not jump between two positions",
    ).toBeGreaterThan(8);
    expect(Math.max(...frames) - Math.min(...frames)).toBeGreaterThan(100);
    evidence.push({ attempt, frames });
  }
  await expect(carousel).toHaveAttribute("data-rotating", "false");
  await carousel.getByRole("button", { name: "Start highlight rotation" }).click();
  await page.mouse.move(0, 0);
  await expect(carousel).toHaveAttribute("data-rotating", "true");
  const beforeRotation = await carousel.getAttribute("data-active-slide");
  await expect(carousel).not.toHaveAttribute("data-active-slide", beforeRotation!, {
    timeout: 12_000,
  });
  await carousel.getByRole("button", { name: "Pause highlight rotation" }).click();
  await page.mouse.move(0, 0);
  await expect(carousel).toHaveAttribute("data-rotating", "false");
  await expect(carousel.getByRole("button", { name: "Start highlight rotation" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(carousel.getByRole("button", { name: "Start highlight rotation" })).toBeDisabled();
  await carousel.getByRole("button", { name: /Show highlight 1:/ }).click();
  await expect(carousel).toHaveAttribute("data-active-slide", "0");
  await info.attach("slide-motion-frames.json", {
    body: JSON.stringify(evidence),
    contentType: "application/json",
  });
});
