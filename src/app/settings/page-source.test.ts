import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(app)/settings/page.tsx"), "utf8");
const actionsSource = readFileSync(join(process.cwd(), "src/app/settings/actions.ts"), "utf8");
const offlineStorageSource = readFileSync(
  join(process.cwd(), "src/app/settings/offline-storage-panel.tsx"),
  "utf8",
);

describe("settings desktop account access", () => {
  it("owns the offline-storage hash exactly once in the section wrapper", () => {
    expect(source.match(/id="offline-storage"/g)).toHaveLength(1);
    expect(offlineStorageSource).not.toContain('id="offline-storage"');
  });

  it("opens saved access views in the section that owns their target", () => {
    expect(source.match(/href: "\/settings\?section=sharing#sharing-settings"/g)).toHaveLength(3);
    expect(source).not.toContain('href: "/settings#sharing-settings"');
  });
  it("uses vertical link buttons for URL-selected settings sections", () => {
    expect(source).toContain("<ButtonGroup");
    expect(source).toContain('orientation="vertical"');
    expect(source).toContain("data-settings-section-navigation");
    expect(source).toContain("href={`/settings?section=${section.value}`}");
    expect(source).toContain('aria-current={section.value === activeSection ? "page" : undefined}');
    expect(source).toContain('variant={section.value === activeSection ? "secondary" : "ghost"}');
    expect(source).not.toContain("TabsTrigger");
    expect(source).not.toContain('from "@/components/ui/tabs"');
  });

  it("uses one genuine Card inside the semantic settings navigation", () => {
    const navigationStart = source.indexOf(
      '<nav className="sticky top-28 min-w-0" aria-label="Settings sections">',
    );
    const navigationEnd = source.indexOf("</nav>", navigationStart);

    expect(navigationStart).toBeGreaterThan(0);
    expect(navigationEnd).toBeGreaterThan(navigationStart);

    const navigation = source.slice(navigationStart, navigationEnd);
    expect(navigation).toContain('<Card className="gap-0 p-3">');
    expect(navigation).toContain('<CardContent className="p-0">');
    expect(navigation.match(/<Card(?:\s|>)/g)).toHaveLength(1);
    expect(navigation).not.toContain("premium-card");
  });

  it("uses the settings artwork variant in the desktop platform header", () => {
    expect(source).toContain('variant="settings"');
    expect(source).toContain("visual={");
    expect(source).toContain("<PageArtwork");
    expect(source).toContain("min-h-36");
  });

  it("keeps account access as an exportable desktop table", () => {
    expect(source).toContain("DesktopTableWorkbenchControls");
    expect(source).toContain('viewKey="settings-access"');
    expect(source).toContain('scope="settings-access"');
    expect(source).toContain('data-workbench-scope="settings-access"');
    expect(source).toContain('exportTableId="settings-access"');
    expect(source).toContain('data-workbench-export-table="settings-access"');
    expect(source).toContain('mainTableLabel="Account access table"');
    expect(source).toContain('mainTableLabel="Account access table" stickyFirstColumn');
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");

    for (const column of ["scope", "party", "role", "status", "detail", "action"]) {
      expect(source).toContain(`data-column="${column}"`);
    }
  });

  it("keeps settings as a platform console without a contextual AI rail", () => {
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("WorkbenchPrompts");
    expect(source).not.toContain("rail={");
  });

  it("uses shadcn Cards, Alert and confirmations for the danger zone", () => {
    expect(source).toContain('<Alert variant="destructive">');
    expect(source).toContain("<AlertTitle>Permanent account actions</AlertTitle>");
    expect(source).toContain('<Card className="ring-destructive/35">');
    expect(source).toContain("<Separator />");
    expect(source).toContain('confirmTitle="Reset all golf data?"');
    expect(source).toContain('confirmTitle="Delete this account permanently?"');
  });

  it("returns every recoverable danger-zone outcome to the danger section", () => {
    expect(actionsSource).toContain(
      'redirect("/settings?section=danger&deleteError=confirmation#danger-zone")',
    );
    expect(actionsSource).toContain(
      '"/login?reason=reauth_required&next=/settings%3Fsection%3Ddanger%26reauth%3D1%23danger-zone"',
    );
    expect(actionsSource).toContain(
      'redirect("/settings?section=danger&resetError=confirmation#danger-zone")',
    );
    expect(actionsSource).toContain('redirect("/settings?section=danger&reset=1#danger-zone")');
  });
});
