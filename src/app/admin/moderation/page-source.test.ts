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
    expect(source).toContain("DesktopWorkbenchLayout");
    expect(source).toContain('<DesktopWorkbenchLayout scope="admin-moderation">');
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("keeps reports and events as separate exportable queue workbenches", () => {
    for (const scope of ["admin-moderation-reports", "admin-moderation-events"]) {
      expect(source).toContain(`data-workbench-scope="${scope}"`);
      expect(source).toContain(`viewKey="${scope}"`);
      expect(source).toContain(`scope="${scope}"`);
      expect(source).toContain(`exportTableId="${scope}"`);
      expect(source).toContain(`data-workbench-export-table="${scope}"`);
    }

    expect(source).toContain("DataTableFrame");
    expect(source).toContain('mainTableLabel="User reports table"');
    expect(source).toContain('label="Moderation events table"');
    expect(source).toContain("stickyFirstColumn");
    expect(source).toContain("<TableCaption");
    expect(source).toContain("tabIndex={0}");
    expect(source.match(/<a\n      href={adminModerationSortHref/g)).toHaveLength(2);
    expect(source).not.toContain('from "next/link"');
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
