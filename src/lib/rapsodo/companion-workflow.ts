import type { RapsodoShotOverride } from "@/lib/imports/save-rapsodo-import";
import type { RapsodoSessionListItem, RapsodoSessionPreview } from "@/lib/rapsodo/sync-types";

export function companionRapsodoInbox(sessions: RapsodoSessionListItem[]) {
  return sessions
    .filter((session) => !session.importedSessionId)
    .sort((left, right) => dateTime(right.dateIso) - dateTime(left.dateIso));
}

export function uncertainCompanionRapsodoShots(
  preview: RapsodoSessionPreview | null,
  excludedShotRowNumbers: readonly number[] = [],
) {
  const excludedRows = new Set(excludedShotRowNumbers);
  return (
    preview?.shots.filter(
      (shot) =>
        !excludedRows.has(shot.rowNumber) &&
        (shot.suggestion.confidence === "low" || shot.suggestion.confidence === "medium"),
    ) ?? []
  );
}

export function buildCompanionRapsodoShotOverrides(
  preview: RapsodoSessionPreview,
  selectedByRow: Record<number, string>,
  excludedShotRowNumbers: readonly number[] = [],
): RapsodoShotOverride[] {
  const choices = new Map(preview.clubChoices.map((choice) => [choice.clubKey, choice]));
  const excludedRows = new Set(excludedShotRowNumbers);

  return preview.shots
    .filter((shot) => !excludedRows.has(shot.rowNumber))
    .map((shot) => {
      const selectedKey = selectedByRow[shot.rowNumber] ?? shot.suggestion.choice.clubKey;
      const choice = choices.get(selectedKey) ?? shot.suggestion.choice;
      return {
        rowNumber: shot.rowNumber,
        clubType: choice.clubType,
        clubBrand: choice.clubBrand,
        clubModel: choice.clubModel,
      };
    });
}

export function companionRapsodoResultHref(sessionId: string) {
  return `/import/result?sessionId=${encodeURIComponent(sessionId)}`;
}

function dateTime(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
