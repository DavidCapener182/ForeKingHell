import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ShotBulkToolbar } from "@/app/shots/shots-master-detail-table";
import { Card, CardContent } from "@/components/ui/card";

describe("shots runtime Card composition", () => {
  it("renders the selected-shot toolbar as a flat toolbar inside the explorer Card", () => {
    const markup = renderToStaticMarkup(
      <Card>
        <CardContent>
          <ShotBulkToolbar
            shotIds={[
              "00000000-0000-4000-8000-000000000001",
              "00000000-0000-4000-8000-000000000002",
              "00000000-0000-4000-8000-000000000003",
            ]}
            selectedCount={3}
            restrictedDeleteCount={1}
            onInspect={vi.fn()}
            onClear={vi.fn()}
          />
        </CardContent>
      </Card>,
    );

    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain("data-shot-bulk-toolbar");
    expect(markup).toContain("Selected shots");
    expect(markup).toContain("Delete selected");
    expect(markup).toContain("1 course-managed shot cannot be permanently deleted here");
    expect(markup).toContain("disabled");
  });

  it("renders an enabled permanent-delete affordance for a range-only selection", () => {
    const markup = renderToStaticMarkup(
      <ShotBulkToolbar
        shotIds={["00000000-0000-4000-8000-000000000001"]}
        selectedCount={1}
        restrictedDeleteCount={0}
        onInspect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(markup).toContain("Delete selected");
    expect(markup).not.toContain("data-shot-delete-blocked");
    expect(markup).not.toContain(' disabled=""');
  });
});
