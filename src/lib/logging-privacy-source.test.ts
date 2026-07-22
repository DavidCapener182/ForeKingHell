import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("server logging privacy", () => {
  it("reports safe error types without raw error messages or objects", () => {
    const observability = readFileSync(join(root, "src/lib/server-observability.ts"), "utf8");
    const aiClient = readFileSync(join(root, "src/lib/ai/client.ts"), "utf8");
    const notifications = readFileSync(
      join(root, "src/app/api/desktop-workbench/notifications/route.ts"),
      "utf8",
    );
    const commands = readFileSync(
      join(root, "src/app/api/desktop-workbench/commands/route.ts"),
      "utf8",
    );
    const playsLike = readFileSync(join(root, "src/app/api/plays-like/route.ts"), "utf8");

    expect(observability).toContain("errorType: safeErrorType(error)");
    expect(observability).toContain("export function reportServerEvent");
    expect(aiClient).toContain('reportServerFailure("ai_cache_persist_failed"');
    expect(aiClient).not.toContain("error instanceof Error ? error.message");
    expect(aiClient).not.toContain("readOpenAiError");
    expect(aiClient).toContain('message: "The AI provider could not complete this request."');
    expect(notifications).toContain('reportServerFailure("workbench_notifications_failed"');
    expect(commands).toContain('reportServerFailure("workbench_commands_failed"');
    expect(notifications).not.toContain("console.warn");
    expect(commands).not.toContain("console.warn");
    expect(playsLike).toContain('reportServerFailure("plays_like_provider_failed"');
    expect(playsLike).not.toContain("error instanceof Error ? error.message");
  });

  it("allow-lists import telemetry and never spreads raw payload fields", () => {
    const imports = readFileSync(join(root, "src/lib/imports/save-rapsodo-import.ts"), "utf8");

    expect(imports).toContain("IMPORT_TELEMETRY_FIELDS");
    expect(imports).toContain("IMPORT_TELEMETRY_FIELDS.has(key)");
    expect(imports).toContain("JSON.stringify({ event: safeEvent, ...safePayload })");
    expect(imports).not.toContain("console.info(event, payload)");
    expect(imports).toContain("class ImportValidationError extends Error");
    expect(imports).toContain('reportServerFailure("import_save_failed"');
    expect(imports).toContain("The import could not be saved.");
    expect(imports).not.toContain(
      'message: error instanceof Error ? error.message : "Import failed."',
    );
  });
});
