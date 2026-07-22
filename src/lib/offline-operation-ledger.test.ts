import { describe, expect, it } from "vitest";

import {
  hashOfflineOperationPayload,
  parseOfflineOperationId,
} from "@/lib/offline-operation-ledger";

describe("offline operation ledger contract", () => {
  it("accepts generated queue identifiers and rejects missing or unsafe values", () => {
    expect(
      parseOfflineOperationId("import-csv-1784660000-123e4567-e89b-12d3-a456-426614174000"),
    ).toBe("import-csv-1784660000-123e4567-e89b-12d3-a456-426614174000");
    expect(parseOfflineOperationId(null)).toBeNull();
    expect(parseOfflineOperationId("short")).toBeNull();
    expect(parseOfflineOperationId("../shared-operation")).toBeNull();
  });

  it("binds an operation identifier to the exact payload without storing that payload", () => {
    const first = hashOfflineOperationPayload({ editKind: "club", fields: [["clubId", "one"]] });
    const duplicate = hashOfflineOperationPayload({
      editKind: "club",
      fields: [["clubId", "one"]],
    });
    const changed = hashOfflineOperationPayload({
      editKind: "club",
      fields: [["clubId", "two"]],
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(duplicate).toBe(first);
    expect(changed).not.toBe(first);
  });
});
