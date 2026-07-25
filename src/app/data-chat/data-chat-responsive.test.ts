import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/data-chat/page.tsx"), "utf8");

describe("Data Chat responsive shell", () => {
  it("uses lg as the only paired-interface cutover and names the page accurately on mobile", () => {
    expect(source).toContain('<MobileTopBar title="Data Chat" />');
    expect(source).toContain('className="hidden lg:grid"');
    expect(source).not.toContain('className="hidden sm:grid"');
    expect(source).toContain('data-data-chat-panel="mobile"');
    expect(source).toContain('data-data-chat-panel="desktop"');
  });
});
