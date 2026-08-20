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
  });
});
