import { afterEach, describe, expect, it, vi } from "vitest";

import { recordProductWorkflowEvent } from "@/lib/product-events";

describe("privacy-safe product workflow events", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records completed workflows without raw golf data or identifiers", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    recordProductWorkflowEvent("shot_review_completed", {
      action: "restored",
      count: 2,
      shotId: "must-not-be-logged",
      rawCsv: "must-not-be-logged",
    });

    expect(info).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(info.mock.calls[0]?.[0]));
    expect(payload).toEqual({
      event: "product_workflow_completed",
      workflow: "shot_review_completed",
      properties: { action: "restored", count: 2 },
    });
    expect(String(info.mock.calls[0]?.[0])).not.toContain("must-not-be-logged");
  });
});
