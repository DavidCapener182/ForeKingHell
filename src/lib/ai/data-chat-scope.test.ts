import { describe, expect, it } from "vitest";

import { selectDataChatScopes } from "@/lib/ai/data-chat-scope";

describe("selectDataChatScopes", () => {
  it("limits a handicap question to round evidence", () => {
    expect([...selectDataChatScopes("What is happening to my handicap?")]).toEqual(["rounds"]);
  });

  it("adds the core improvement evidence for a trend question", () => {
    expect(selectDataChatScopes("What is getting worse?")).toEqual(
      new Set(["shots", "bag", "practice"]),
    );
  });

  it("does not include social or equipment context by default", () => {
    const scopes = selectDataChatScopes("What should I work on next?");
    expect(scopes.has("practice")).toBe(true);
    expect(scopes.has("social")).toBe(false);
    expect(scopes.has("equipment")).toBe(false);
  });
});
