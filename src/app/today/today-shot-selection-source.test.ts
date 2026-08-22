import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const chartsSource = readFileSync(
  join(process.cwd(), "src/app/today/today-shot-charts.tsx"),
  "utf8",
);
const railSource = readFileSync(
  join(process.cwd(), "src/app/today/today-selected-shot-rail.tsx"),
  "utf8",
);
const dataSource = readFileSync(join(process.cwd(), "src/lib/today-shot-detail-data.ts"), "utf8");
const pageSource = readFileSync(
  join(process.cwd(), "src/app/(app)/today/today-workbench-page.tsx"),
  "utf8",
);

describe("Today chart shot selection", () => {
  it("makes exact dispersion points and individual flights pointer and keyboard selectable", () => {
    expect(chartsSource).toContain("data-today-shot-point={shot.id}");
    expect(chartsSource).toContain("data-today-shot-flight={shot.id}");
    expect(chartsSource).toContain('role={onSelectShot ? "button" : "img"}');
    expect(chartsSource).toContain('role={selectable ? "button" : "img"}');
    expect(chartsSource).toContain("aria-pressed={onSelectShot ? selected : undefined}");
    expect(chartsSource).toContain('event.key !== "Enter" && event.key !== " "');
    expect(chartsSource).toContain("onSelectShot(shotId)");
  });

  it("replaces the right chart with useful exact-shot details and existing mutation controls", () => {
    expect(chartsSource).toContain("<TodaySelectedShotRail");
    expect(chartsSource).toContain('import("@/app/today/today-selected-shot-rail")');
    expect(chartsSource).not.toContain('from "@/app/shots/shot-review-controls"');
    expect(railSource).toContain('aria-label="Selected chart shot details"');
    expect(railSource).toContain("<SelectedShotDetail");
    expect(railSource).toContain("<ShotReviewButton");
    expect(railSource).toContain("<ShotDeleteButton");
    expect(railSource).toContain("Exclude from stats");
    expect(railSource).toContain("detail.canDeletePermanently");
    expect(railSource).toContain("Permanent deletion is");
    expect(railSource).toContain("course or round workflow so the score stays correct");
  });

  it("loads only owner-scoped detail DTOs and attaches them to their chart shot", () => {
    expect(dataSource).toContain('import "server-only"');
    expect(dataSource).toContain("eq(shots.userId, input.userId)");
    expect(dataSource).toContain("eq(sessions.userId, input.userId)");
    expect(dataSource).toContain("eq(clubs.userId, input.userId)");
    expect(dataSource).toContain("eq(shotReviewEvents.userId, input.userId)");
    expect(dataSource).toContain("eq(rapsodoSyncSessions.userId, input.userId)");
    expect(dataSource).toContain("rapsodoSyncSessions.providerSessionMode");
    expect(dataSource).toContain("desc(rapsodoSyncSessions.updatedAt)");
    expect(dataSource).toContain("providerMetadataBySessionId");
    expect(dataSource).toContain("!providerMetadataBySessionId.has(providerSession.sessionId)");
    expect(dataSource).toContain("providerKind: providerMetadata?.providerKind ?? null");
    expect(dataSource).toContain(
      "providerSessionMode: providerMetadata?.providerSessionMode ?? null",
    );
    expect(pageSource).toContain("getTodayShotDetailRows({");
    expect(pageSource).toContain("detail: detailsById.get(shot.id) ?? null");
  });

  it("batches every plotted shot ID instead of dropping details after an arbitrary cap", () => {
    expect(dataSource).toContain("TODAY_DETAIL_QUERY_BATCH_SIZE");
    expect(dataSource).toContain("chunkTodayDetailIds(shotIds)");
    expect(dataSource).not.toContain("MAX_TODAY_DETAIL_SHOTS");
    expect(dataSource).not.toContain(".slice(0, MAX_TODAY_DETAIL_SHOTS)");
  });
});
