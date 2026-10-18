import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SharedSessionLedger } from "./shared-session-ledger";
vi.mock("next/navigation", () => ({
  usePathname: () => "/shared/synthetic-player",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/use-client-ready", () => ({ useClientReady: () => true }));
vi.mock("@/components/app/desktop-workbench-controls", () => ({
  DesktopWorkbenchControls: () => null,
}));
vi.mock("@/components/app/responsive-detail-panel", () => ({ ResponsiveDetailPanel: () => null }));
describe("shared session mobile evidence parity", () => {
  it("includes score and hole count in both desktop and mobile representations", () => {
    const markup = renderToStaticMarkup(
      <SharedSessionLedger
        rows={[
          {
            id: "synthetic-round",
            date: "2026-10-18T12:00:00Z",
            type: "round",
            courseName: "Synthetic test course",
            fileName: null,
            holesPlayed: 18,
            totalScore: 84,
          },
        ]}
        total={1}
      />,
    );
    expect(markup.match(/data-column="score"/g)).toHaveLength(3);
    expect(markup).toContain("Scorecard total: 84");
    expect(markup).toContain("18 recorded holes");
  });
  it("keeps an incomplete score unavailable instead of showing zero on mobile", () => {
    const markup = renderToStaticMarkup(
      <SharedSessionLedger
        rows={[
          {
            id: "synthetic-partial",
            date: "2026-10-18T12:00:00Z",
            type: "round",
            courseName: null,
            fileName: null,
            holesPlayed: 6,
            totalScore: null,
          },
        ]}
        total={1}
      />,
    );
    expect(markup).toContain("Scorecard total: Incomplete / unavailable");
  });
});
