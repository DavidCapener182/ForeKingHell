import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/components/features/feature-panels.tsx"),
  "utf8",
);

describe("feature panel source", () => {
  it("keeps bag fitting alerts readable before the ultra-wide target-selector split", () => {
    const bagPanelBlock =
      source.match(
        /export function BagFeaturePanel[\s\S]*?export function SavedShotViewsPanel/,
      )?.[0] ?? "";

    expect(bagPanelBlock).toContain("Bag fitting and target selector");
    expect(bagPanelBlock).toContain("min-[2400px]:grid-cols-[minmax(0,1fr)_360px]");
    expect(bagPanelBlock).not.toContain("xl:grid-cols-[minmax(0,1fr)_360px]");
  });

  it("keeps course-record goal cards readable beside the records rail", () => {
    const courseRecordBlock =
      source.match(
        /export function CourseRecordFeaturePanel[\s\S]*?export function CourseFollowFeaturePanel/,
      )?.[0] ?? "";

    expect(courseRecordBlock).toContain("Course-record goals");
    expect(courseRecordBlock).toContain("lg:grid-cols-2 2xl:grid-cols-3");
    expect(courseRecordBlock).not.toContain("md:grid-cols-2 xl:grid-cols-3");
  });

  it("keeps social preview cards stacked until the panel column is wide enough", () => {
    const socialPanelBlock =
      source.match(
        /export function SocialFeaturePanel[\s\S]*?export function ProfileFeaturePanel/,
      )?.[0] ?? "";

    expect(socialPanelBlock).toContain("Social support controls");
    expect(socialPanelBlock).toContain("xl:grid-cols-[minmax(0,1fr)_360px]");
    expect(socialPanelBlock).toContain("min-[1500px]:grid-cols-2");
    expect(socialPanelBlock).not.toContain("lg:grid-cols-[minmax(0,1fr)_360px]");
  });

  it("keeps saved-view cards equal height while the form stays collapsed", () => {
    const savedViewsBlock =
      source.match(
        /export function SavedShotViewsPanel[\s\S]*?export function CoachPracticeFeaturePanel/,
      )?.[0] ?? "";

    expect(savedViewsBlock).toContain("grid auto-rows-fr items-stretch gap-2 md:grid-cols-3");
    expect(savedViewsBlock).toContain("h-full rounded-lg border border-slate-200 bg-white p-3");
    expect(savedViewsBlock).toContain("<Collapsible");
    expect(savedViewsBlock).toContain("<CollapsibleTrigger");
    expect(savedViewsBlock).toContain("<CollapsibleContent");
    expect(savedViewsBlock).not.toContain("<details");
  });
});
