import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsMobileDisclosure } from "./settings-mobile-disclosure";

describe("SettingsMobileDisclosure", () => {
  it("exposes an accessible relationship between the trigger and panel", () => {
    const html = renderToStaticMarkup(
      <SettingsMobileDisclosure id="profile-settings" title="Profile" description="Units and theme">
        <p>Profile settings form</p>
      </SettingsMobileDisclosure>,
    );

    expect(html).toContain('id="profile-settings"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="profile-settings-content"');
    expect(html).toContain('id="profile-settings-content"');
    expect(html).toContain("min-h-14");
  });

  it("supports a section that starts open without duplicating its content", () => {
    const html = renderToStaticMarkup(
      <SettingsMobileDisclosure id="data-health" title="Data health" defaultOpen>
        <p>Connected providers</p>
      </SettingsMobileDisclosure>,
    );

    expect(html).toContain('aria-expanded="true"');
    expect(html.match(/Connected providers/g)).toHaveLength(1);
  });
});
