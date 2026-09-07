import { formatCompanionClubType } from "@/lib/club-format";
import { buildMobileTodayChange } from "@/lib/mobile-today-briefing";
import { directionIsUsable } from "@/lib/session-data-confidence";
import type { TodayPracticeData } from "@/lib/today-session-data";

export type TodayHighlight = {
  id: string;
  label: string;
  title: string;
  value: string;
  description: string;
  evidence: string;
  href: string;
  action: string;
};
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function buildTodayHighlights(data: TodayPracticeData | null): TodayHighlight[] {
  if (!data?.shots.length) return [];
  const slides: TodayHighlight[] = [];
  const longest = [...data.shots]
    .filter((shot) => shot.carryYd !== null && Number.isFinite(shot.carryYd) && shot.carryYd > 0)
    .sort((a, b) => b.carryYd! - a.carryYd!)[0];
  const scope = `${data.dateLabel} · ${data.sessions.length} ${data.sessions.length === 1 ? "session" : "sessions"}`;
  if (longest)
    slides.push({
      id: "longest",
      label: "Longest carry",
      title: `${formatCompanionClubType(longest.clubType)} carried furthest`,
      value: `${number.format(longest.carryYd!)} yd`,
      description:
        "Your longest eligible carry in this review. This is a peak shot, not your stock playing distance.",
      evidence: `${scope} · shot ${longest.shotNumber ?? "—"}`,
      href: `/shots?sessionId=${longest.sessionId}&shotId=${longest.id}`,
      action: "Inspect this shot",
    });
  const straightest = [...data.shots]
    .filter(
      (shot) =>
        shot.sideCarryYd !== null &&
        Number.isFinite(shot.sideCarryYd) &&
        directionIsUsable(shot.dataConfidence, shot.id),
    )
    .sort((a, b) => Math.abs(a.sideCarryYd!) - Math.abs(b.sideCarryYd!))[0];
  if (straightest)
    slides.push({
      id: "control",
      label: "Closest to the target line",
      title: `${formatCompanionClubType(straightest.clubType)} held the line`,
      value: `${number.format(Math.abs(straightest.sideCarryYd!))} yd offline`,
      description:
        "The smallest recorded sideways miss in this review. This measures the target line, not distance to the pin.",
      evidence: `${scope} · shot ${straightest.shotNumber ?? "—"}`,
      href: `/shots?sessionId=${straightest.sessionId}&shotId=${straightest.id}`,
      action: "Inspect this shot",
    });
  const change = buildMobileTodayChange(data);
  if (change)
    slides.push({
      id: "change",
      label: "Since comparable practice",
      title: `${change.clubLabel} carry is ${Math.abs(change.delta)} yd ${change.delta > 0 ? "longer" : "shorter"}`,
      value: `${number.format(change.latest.value)} yd average`,
      description: `Compared with ${number.format(change.previous.value)} yd in the earlier sample. A change in carry alone does not establish improvement or its cause.`,
      evidence: `${change.latest.count} current / ${change.previous.count} earlier carry readings · ${data.dateLabel}`,
      href: change.latest.sessions[0]?.href ?? "/sessions",
      action: "Review comparison evidence",
    });
  return slides;
}
