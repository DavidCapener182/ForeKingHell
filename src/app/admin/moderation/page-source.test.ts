import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(admin)/admin/moderation/page.tsx"),
  "utf8",
);
const queue = readFileSync(join(process.cwd(), "src/app/admin/moderation-queue.tsx"), "utf8");

describe("admin moderation desktop console source", () => {
  it("uses a shared admin moderation workbench without adding a contextual AI rail", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("<PageHeader");
    expect(source).toContain('<AdminNav active="/admin/moderation" />');
    expect(source).toContain("getAdminModerationData()");
    expect(source.match(/<PageShell>/g)).toHaveLength(1);
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps reports and events as separate exportable queue workbenches", () => {
    expect(queue).toContain(
      'kind === "report" ? "admin-moderation-reports" : "admin-moderation-events"',
    );
    for (const attribute of [
      "viewKey",
      "scope",
      "data-workbench-scope",
      "data-workbench-export-table",
    ]) {
      expect(queue).toContain(`${attribute}={scope}`);
    }
    expect(queue).toContain("<DesktopWorkbenchControls");
    expect(queue).toContain("exportFileName={`${scope}-filtered.csv`}");
    expect(queue).toContain("localView={{");
    expect(queue).toContain("shown.map((row) => (");
    expect(queue).toContain("data-column={column.id}");
    expect(queue).toContain("tabIndex={0}");
    expect(queue).toContain("<caption");
    for (const column of [
      "id",
      "label",
      "status",
      "targetType",
      "targetId",
      "reason",
      "details",
      "actor",
      "reportedUser",
      "severity",
      "created",
      "resolved",
      "metadata",
    ]) {
      expect(queue).toContain(`id: "${column}"`);
    }
    expect(queue).toContain("url.searchParams.set(`${kind}Q`, next.query)");
  });

  it("keeps moderation bulk and row actions confirmable", () => {
    expect(source).toContain("<ModerationQueue");
    expect(queue).toContain('kind === "report" ? "bulk-resolve-reports" : "bulk-resolve-events"');
    expect(queue).toContain("setReview(chosen)");
    expect(queue).toContain("review?.map((row)");
    expect(queue).toContain('data.append(kind === "report" ? "reportId" : "eventId", row.id)');
    expect(queue).toContain("Confirm selected resolution");
    expect(queue).toContain("if (lock.current || !review) return");
    expect(queue).toContain("if (!pending && !open)");
    expect(source).toContain("Moderation audit history");
  });

  it("announces selected bulk rows and blocks empty bulk submits", () => {
    expect(queue).toContain(
      'shown.filter((row) => row.status === "open" && selected.includes(row.id))',
    );
    expect(queue).toContain('<p role="status"');
    expect(queue).toContain("{chosen.length} selected");
    expect(queue).toContain("disabled={!ready || !chosen.length}");
    expect(queue).toContain("Select visible open records");
    expect(queue).toContain("setSelected([])");
  });

  it("excludes companion moderation sheets from the desktop-only route", () => {
    for (const obsolete of [
      "AdminMobileShell",
      "AdminMobileModeration",
      "MobileModerationRecordSheet",
      "MobileModerationRows",
      "MobileTabBar",
      "BottomSheet",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });
});
