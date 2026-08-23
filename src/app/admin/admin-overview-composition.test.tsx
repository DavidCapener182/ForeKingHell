import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OperationalStatusStrip, OperationsPanel } from "@/app/admin/admin-overview-components";

describe("admin overview operations-console composition", () => {
  it("renders one connected status strip without consumer Card components", () => {
    const markup = renderToStaticMarkup(
      <OperationalStatusStrip
        items={[
          {
            label: "Provider issues",
            value: "2 failed",
            detail: "Import snapshot",
            status: "failure",
          },
          {
            label: "Billing issues",
            value: "None recorded",
            detail: "Billing snapshot",
            status: "recorded-none",
          },
          {
            label: "Moderation queue",
            value: "3 open",
            detail: "Open queue",
            status: "queue",
          },
          {
            label: "User/account actions",
            value: "Unknown",
            detail: "No connected queue",
            status: "unverified",
          },
          {
            label: "System verification",
            value: "Unverified",
            detail: "No live result",
            status: "unverified",
          },
        ]}
      />,
    );

    expect(markup).toContain("Provider issues");
    expect(markup).toContain("System verification");
    expect(markup.match(/data-slot="badge"/g)).toHaveLength(5);
    expect(markup).not.toContain('data-slot="card"');
  });

  it("uses a flat bordered operations panel rather than a consumer Card", () => {
    const markup = renderToStaticMarkup(
      <OperationsPanel title="Attention required" description="Evidence-led queue.">
        <table>
          <tbody>
            <tr>
              <td>Provider imports</td>
            </tr>
          </tbody>
        </table>
      </OperationsPanel>,
    );

    expect(markup).toContain("Attention required");
    expect(markup).toContain("Provider imports");
    expect(markup).not.toContain('data-slot="card"');
  });
});
