import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/ui/resizable.tsx"), "utf8");

describe("resizable separator accessibility", () => {
  it("provides valid value semantics during initial panel registration", () => {
    expect(source).toContain('element.setAttribute("aria-valuemin", "0")');
    expect(source).toContain('element.setAttribute("aria-valuemax", "100")');
    expect(source).toContain('element.setAttribute("aria-valuenow", "50")');
    expect(source).toContain("elementRef={accessibleElementRef}");
    expect(source).toContain("new MutationObserver");
    expect(source).toContain(
      'attributeFilter: ["aria-valuemin", "aria-valuemax", "aria-valuenow"]',
    );
    expect(source).toContain("if (!mounted)");
    expect(source).toContain("useSyncExternalStore(");
    expect(source).not.toContain("setMounted");
    expect(source).toContain('data-slot="resizable-handle-placeholder"');
    expect(source).toContain('aria-hidden="true"');
  });
});
