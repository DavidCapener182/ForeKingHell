import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/app-surface-server", () => ({ getRequestAppSurface: vi.fn() }));
import { getRequestAppSurface } from "@/lib/app-surface-server";
import SessionNotFound from "@/app/(app)/sessions/not-found";
describe("missing session recovery", () => {
  it("returns phone users to their history", async () => {
    vi.mocked(getRequestAppSurface).mockResolvedValue("companion");
    const html = renderToStaticMarkup(await SessionNotFound());
    expect(html).toContain("Session unavailable");
    expect(html).toContain('href="/sessions"');
    expect(html).not.toContain("Open dashboard");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
  it("retains the workbench recovery", async () => {
    vi.mocked(getRequestAppSurface).mockResolvedValue("workbench");
    const html = renderToStaticMarkup(await SessionNotFound());
    expect(html).toContain("Open dashboard");
    expect(html).not.toContain("data-mobile-session-not-found");
  });
});
