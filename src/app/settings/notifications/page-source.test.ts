import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/app/(app)/settings/notifications/page.tsx"),
  "utf8",
);

describe("notification settings mobile composition", () => {
  it("uses labelled delivery groups and shared draft-preserving save behavior", () => {
    expect(source.match(/<fieldset/g)).toHaveLength(2);
    expect(source).toContain("Delivery by category");
    expect(source).toContain("<Switch");
    expect(source).toContain("<SettingsDirtyForm action={saveNotificationPreferencesFormAction}");
    expect(source).toContain(
      "saving this form does not send an email or enable push notifications",
    );
  });

  it("keeps delivery selectors and compatibility switches uniquely labelled", () => {
    expect(source).toContain("htmlFor={`delivery-${option.key}`}");
    expect(source).toContain("id={`delivery-${option.key}`}");
    expect(source).toContain("htmlFor={`legacy-${option.key}`}");
    expect(source).toContain("id={`legacy-${option.key}`}");
    expect(source).not.toContain("htmlFor={option.key}");
  });

  it("announces shared save and error feedback", () => {
    const form = readFileSync(
      join(process.cwd(), "src/app/settings/settings-dirty-form.tsx"),
      "utf8",
    );
    expect(form).toContain('role="status">Settings saved.');
    expect(form).toContain('role="alert"');
    expect(form).toContain("Your draft is retained");
    expect(source).not.toContain("bg-emerald-");
  });
});
