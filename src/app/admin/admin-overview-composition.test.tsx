import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminLink } from "@/app/(admin)/admin/page";
import { AdminSection } from "@/app/admin/admin-components";

describe("admin overview operating-page composition", () => {
  it("renders one section Card with four flat Item links", () => {
    const links = [
      ["/admin/users", "Users", "Find accounts and manage operators."],
      ["/admin/billing", "Billing", "Inspect subscriptions and entitlements."],
      ["/admin/moderation", "Moderation", "Resolve reports and safety events."],
      ["/admin/challenges", "Challenges", "Track templates, entries and results."],
    ] as const;
    const markup = renderToStaticMarkup(
      <AdminSection title="Operating pages">
        <div>
          {links.map(([href, title, description]) => (
            <AdminLink key={href} href={href} title={title} description={description} />
          ))}
        </div>
      </AdminSection>,
    );

    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup.match(/data-slot="item"/g)).toHaveLength(4);
    expect(markup.match(/data-admin-operating-link/g)).toHaveLength(4);
    for (const [href] of links) {
      expect(markup).toContain(`href="${href}"`);
    }
  });
});
