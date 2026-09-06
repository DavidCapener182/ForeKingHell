import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UntitledPageHeader, UntitledSectionHeader } from "./headers";

describe("responsive header content contract", () => {
  it("renders one title and preserves every action, unit and evidence detail", () => {
    const html = renderToStaticMarkup(
      <UntitledPageHeader
        title="A saved session with a long golfer-provided name"
        description="Measured carry from reviewed shots, not estimated total distance."
        actions={
          <>
            <button type="submit" name="intent" value="save">
              Save
            </button>
            <Link href="/sessions">All sessions</Link>
          </>
        }
        metrics={[
          { label: "Carry", value: "142 yd", detail: "12 measured shots" },
          { label: "Total", value: "156 yd", detail: "Provider-reported total" },
        ]}
      />,
    );
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    const submitButton = html.match(/<button\b[^>]*>/)?.[0];
    expect(submitButton).toContain('name="intent"');
    expect(submitButton).toContain('value="save"');
    expect(submitButton).toContain('type="submit"');
    expect(html).toContain('href="/sessions"');
    expect(html).toContain("142 yd");
    expect(html).toContain("Provider-reported total");
    expect(html.match(/<dt>/g)).toHaveLength(2);
  });

  it("keeps a semantic section title and supplied recovery action", () => {
    const html = renderToStaticMarkup(
      <UntitledSectionHeader
        title="Session evidence"
        description="No matching shots"
        action={<button>Clear filters</button>}
      />,
    );
    expect(html.match(/<h2\b/g)).toHaveLength(1);
    expect(html).toContain("No matching shots");
    expect(html).toContain("Clear filters");
  });
});
