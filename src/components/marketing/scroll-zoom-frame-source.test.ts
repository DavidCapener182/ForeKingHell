import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/marketing/scroll-zoom-frame.tsx"),
  "utf8",
);

describe("marketing scroll zoom", () => {
  it("uses viewport-scoped composited transforms and respects reduced motion", () => {
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain('addEventListener("scroll", requestUpdate, { passive: true })');
    expect(source).toContain('style.setProperty("--marketing-zoom"');
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain("removeEventListener");
  });
});
