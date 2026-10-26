import { expect, it } from "vitest";
import { offlineDestination } from "./offline-destination";
it("preserves the failed destination and companion shortcut including drill-down state", () => {
  for (const section of ["today", "sessions", "practice", "play", "bag"])
    for (const path of [
      `/${section}`,
      `/surface/companion?next=${encodeURIComponent(`/${section}`)}`,
    ])
      expect(offlineDestination(new URL(path, "https://golf.example"))).toEqual({
        section,
        target: `/${section}`,
      });
  expect(offlineDestination(new URL("https://golf.example/progress"))).toEqual({
    section: "sessions",
    target: "/progress",
  });
  expect(offlineDestination(new URL("https://golf.example/practice?planId=saved"))).toEqual({
    section: "practice",
    target: "/practice?planId=saved",
  });
  expect(
    offlineDestination(new URL("https://golf.example/offline?view=saved&section=play")),
  ).toEqual({ section: "play", target: "/play" });
});
it("never creates an external reconnect destination from a shortcut", () => {
  for (const next of ["https://other.example/bag", "//other.example/bag", "/\\other.example/bag"])
    expect(
      offlineDestination(
        new URL(`/surface/companion?next=${encodeURIComponent(next)}`, "https://golf.example"),
      ),
    ).toEqual({ section: "today", target: "/today" });
});
it("keeps saved Practice destinations independent of primary-tab visibility", () => {
  expect(offlineDestination(new URL("https://golf.example/offline?section=practice"))).toEqual({
    section: "practice",
    target: "/practice",
  });
  for (const path of ["/practice/quick-range?planId=saved#block-2", "/coach?report=saved"]) {
    expect(offlineDestination(new URL(path, "https://golf.example"))).toEqual({
      section: "practice",
      target: path,
    });
  }
});
