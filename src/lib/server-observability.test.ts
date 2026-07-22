import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/lib/server-observability.ts"), "utf8");
const instrumentation = readFileSync(join(process.cwd(), "src/instrumentation.ts"), "utf8");

describe("server observability boundary", () => {
  it("registers provider-neutral OpenTelemetry tracing", () => {
    expect(instrumentation).toContain('registerOTel({ serviceName: "forekinghell-web" })');
    expect(instrumentation).toContain("onRequestError");
  });

  it("records duration and row counts without logging messages or payloads", () => {
    expect(source).toContain('event: "server_operation"');
    expect(source).toContain('span.setAttribute("db.row_count", rowCount)');
    expect(source).toContain("durationMs");
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("JSON.stringify(error)");
  });
});
