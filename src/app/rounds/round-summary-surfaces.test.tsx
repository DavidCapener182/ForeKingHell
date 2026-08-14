import { renderToStaticMarkup } from "react-dom/server";
import { Flag } from "lucide-react";
import { describe, expect, it } from "vitest";

import { RoundMetricItem, RoundTaskItem } from "@/app/rounds/round-summary-surfaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

describe("round summary runtime composition", () => {
  it("renders metric and task Items inside one section Card without nesting another Card", () => {
    const markup = renderToStaticMarkup(
      <Card>
        <CardContent>
          <RoundMetricItem label="Rounds saved" value="24" detail="18 real · 6 simulator" />
          <RoundTaskItem
            icon={Flag}
            title="Latest recap"
            detail="Create a recap from the latest round."
            action={<Button variant="outline">Create recap</Button>}
          />
        </CardContent>
      </Card>,
    );

    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup.match(/data-slot="item"/g)).toHaveLength(2);
    expect(markup).toContain("data-round-metric-item");
    expect(markup).toContain("data-round-task-item");
  });
});
