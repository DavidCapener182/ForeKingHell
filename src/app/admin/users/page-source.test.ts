import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/(admin)/admin/users/page.tsx"), "utf8");
const actionsSource = readFileSync(
  join(process.cwd(), "src/app/admin/admin-user-actions.tsx"),
  "utf8",
);

describe("admin users desktop console source", () => {
  it("uses the shared workbench shell without adding a contextual AI rail", () => {
    expect(source).toContain("<PageShell>");
    expect(source).toContain("<PageHeader");
    expect(source).toContain("requireAdminUser()");
    expect(source).not.toMatch(/max-w-(?:6xl|7xl|\[1500px\])/);
    expect(source).not.toContain("DesktopInsightRail");
    expect(source).not.toContain("rail={");
  });

  it("uses a full-width table with the requested account-management columns", () => {
    expect(source).toContain("<AdminUserDirectory");
    expect(actionsSource).toContain("<DesktopWorkbenchControls");
    expect(actionsSource).toContain('aria-label="Admin user accounts table"');
    expect(actionsSource).toContain("tabIndex={0}");
    expect(actionsSource).toContain('data-workbench-scope="admin-users"');
    expect(actionsSource).toContain('data-workbench-export-table="admin-users"');
    expect(actionsSource).toContain("viewKey={`admin-users:${currentUserId}`}");
    expect(actionsSource).toContain("<caption");
    expect(actionsSource).toContain("users.map");

    for (const column of ["user", "email", "plan", "activity", "admin", "created", "action"]) {
      expect(source + actionsSource).toContain(`data-column="${column}"`);
    }
  });

  it("preserves search while applying reviewed account filters and ordering", () => {
    const filters = readFileSync(
      join(process.cwd(), "src/app/admin/admin-user-filters.tsx"),
      "utf8",
    );
    expect(source).toContain("<AdminUserFilters");
    expect(filters).toContain('action="/admin/users"');
    expect(filters).toContain('name="q" defaultValue={q}');
    expect(filters).toContain("Object.entries({ role, plan, status, order })");
    expect(filters).toContain("setDraft({ role, plan, status, order })");
    expect(filters).toContain('title="Account filters"');
    expect(filters).toContain("new FormData(form.current)");
    expect(filters).toContain("Object.entries(draft)");
    expect(filters).toContain("Array.from(data.entries())");
    expect(source).toContain("sortAdminUsers(filterAdminUsers(users, filters), order)");
    expect(source).not.toContain('title="Grant lifetime full"');
  });

  it("keeps exact account changes behind a reviewed form snapshot", () => {
    expect(source).toContain("AdminUserDirectory");
    expect(source).toContain("AdminAccessDialog");
    expect(actionsSource).toContain("<ResponsiveDetailPanel");
    expect(actionsSource).toContain("Recent account audit");
    for (const operation of ["grant-lifetime", "grant-admin", "deactivate-admin"]) {
      expect(actionsSource).toContain(`operation="${operation}"`);
    }
    expect(actionsSource).toContain('name="userId" value={selected.id}');
    expect(actionsSource).toContain("selected.id !== currentUserId");
    expect(actionsSource).toContain("canManageOwners");
    const form = readFileSync(
      join(process.cwd(), "src/app/admin/admin-operation-form.tsx"),
      "utf8",
    );
    expect(form).toContain("new FormData(e.currentTarget)");
    expect(form).toContain('data.set("operation", operation)');
    expect(form).toContain("setReview(data)");
    expect(form).toContain("Array.from(review.entries())");
    expect(form).toContain("adminFormAction({ ok: false }, review)");
    expect(form).toContain("Cancel review");
    expect(form).toContain("disabled={!ready || pending || review !== null}");
  });

  it("excludes companion search and grant sheets from the desktop-only route", () => {
    for (const obsolete of [
      "AdminMobileShell",
      "AdminMobileUsers",
      "MobileUserTools",
      "MobileAdminUserRows",
      "BottomSheet",
      "IOSDisclosureGroup",
      "getRequestAppSurface",
      'surface === "companion"',
    ]) {
      expect(source).not.toContain(obsolete);
    }
  });
});
