import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Performance Lab imported controls", () => {
  it("uses shadcn selection and semantic status chrome in the gapping matrix", () => {
    const matrix = source("src/app/simulator-lab/gapping-matrix-client.tsx");

    expect(matrix).toContain('import { Button } from "@/components/ui/button"');
    expect(matrix).toContain("<Button");
    expect(matrix).not.toContain("<button");
    expect(matrix).toContain("var(--status-success-surface)");
    expect(matrix).toContain("var(--status-warning-surface)");
    expect(matrix).not.toMatch(/bg-white|border-emerald|text-(?:emerald|amber|sky|slate)-\d+/);
  });

  it("uses the shared Slider and Progress for the what-if model", () => {
    const whatIf = source("src/app/simulator-lab/what-if-client.tsx");
    const slider = source("src/components/ui/slider.tsx");

    expect(whatIf).toContain('import { Slider } from "@/components/ui/slider"');
    expect(whatIf).toContain("<Slider");
    expect(whatIf).toContain("<Progress");
    expect(whatIf).not.toContain('type="range"');
    expect(whatIf).not.toMatch(/bg-emerald|text-emerald|bg-\[#/);
    expect(slider).toContain('import { Slider as SliderPrimitive } from "radix-ui"');
    expect(slider).toContain('data-slot="slider-thumb"');
  });

  it("keeps roast actions and recoverable status on semantic shadcn controls", () => {
    const roast = source("src/app/simulator-lab/session-roast-panel.tsx");

    expect(roast).toContain("<Button");
    expect(roast).toContain("type RoastNotice = {");
    expect(roast).toContain('kind: "success" | "error"');
    expect(roast).toContain('<Alert variant="destructive" data-roast-status="error">');
    expect(roast).toContain('data-roast-status="success"');
    expect(roast).toContain("var(--status-success-border)");
    expect(roast).toContain("var(--status-success-surface)");
    expect(roast).toContain("var(--status-success-foreground)");
    expect(roast).toContain("<AlertDescription>{notice.message}</AlertDescription>");
    expect(roast).toContain('message: "Saved as a private feed draft."');
    expect(roast).not.toContain("const [message, setMessage]");
    expect(roast).not.toContain('<p className="text-sm text-muted-foreground">{message}</p>');
    expect(roast).not.toMatch(/bg-\[#0B7A3B\]|text-white|hover:bg-\[#064E3B\]/);
  });
});
