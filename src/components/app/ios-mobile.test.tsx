import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  IOSDisclosureGroup,
  IOSGroupedList,
  IOSListRow,
  IOSMetricRow,
} from "@/components/app/ios-mobile";

describe("iOS mobile primitives", () => {
  it("renders concise grouped rows with semantic navigation and complete values", () => {
    const markup = renderToStaticMarkup(
      <IOSGroupedList label="Golf account">
        <IOSListRow
          label="Profile"
          detail="Name and public identity"
          value="Golfer"
          href="/profile"
          ariaLabel="Open profile settings"
        />
        <IOSMetricRow label="Weekly sessions" value="2 / 3" detail="One session remaining" />
      </IOSGroupedList>,
    );

    expect(markup).toContain('aria-label="Golf account"');
    expect(markup).toContain('href="/profile"');
    expect(markup).toContain('aria-label="Open profile settings"');
    expect(markup).toContain("Name and public identity");
    expect(markup).toContain("2 / 3");
    expect(markup).toContain("One session remaining");
  });

  it("exposes an expanded state and a valid trigger-to-panel relationship", () => {
    const markup = renderToStaticMarkup(
      <IOSDisclosureGroup
        label="Supporting evidence"
        defaultValue="trend"
        items={[
          {
            value: "trend",
            title: "Trend",
            summary: "6 rounds",
            content: <p>Measured trend evidence</p>,
          },
          {
            value: "method",
            title: "Method",
            summary: "About",
            content: <p>Calculation method</p>,
          },
        ]}
      />,
    );
    const openTrigger = markup.match(/aria-controls="([^"]+)"[^>]*aria-expanded="true"/);

    expect(markup).toContain('aria-label="Supporting evidence"');
    expect(markup).toContain('data-state="open"');
    expect(markup).toContain('aria-expanded="false"');
    expect(openTrigger?.[1]).toBeTruthy();
    expect(markup).toContain(`id="${openTrigger?.[1]}"`);
    expect(markup).toContain("Measured trend evidence");
  });

  it("does not render an empty disclosure shell", () => {
    expect(renderToStaticMarkup(<IOSDisclosureGroup items={[]} />)).toBe("");
  });
});
