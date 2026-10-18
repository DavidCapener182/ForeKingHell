import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuickBagClient } from "./quick-bag-client";
describe("Quick Bag empty evidence", () => {
  it("offers setup and import actions instead of an unanswerable target picker", () => {
    const html = renderToStaticMarkup(
      <QuickBagClient clubs={[]} accountId="synthetic-test-owner" />,
    );
    expect(html).toContain('href="/bag"');
    expect(html).toContain('href="/import"');
    expect(html).not.toContain('id="quick-bag-target"');
    expect(html).not.toContain("synthetic-test-owner");
  });
});
