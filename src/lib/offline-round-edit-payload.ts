export const offlineRoundEditKinds = [
  "round-context",
  "round-course-link",
  "round-hole",
  "shot-club",
  "club",
  "resplit-round",
] as const;

export type OfflineRoundEditKind = (typeof offlineRoundEditKinds)[number];

export type OfflineRoundEditPayload = {
  editKind: OfflineRoundEditKind;
  fields: Array<[string, string]>;
};

export function parseOfflineRoundEditPayload(value: unknown): OfflineRoundEditPayload | null {
  if (!isRecord(value) || !isOfflineRoundEditKind(value.editKind) || !Array.isArray(value.fields)) {
    return null;
  }

  const fields = value.fields
    .map((field): [string, string] | null => {
      if (!Array.isArray(field) || field.length !== 2) {
        return null;
      }

      const [key, fieldValue] = field;

      return typeof key === "string" && typeof fieldValue === "string" ? [key, fieldValue] : null;
    })
    .filter((field): field is [string, string] => field !== null);

  return fields.length > 0 ? { editKind: value.editKind, fields } : null;
}

export function offlineRoundEditPayloadToFormData(payload: OfflineRoundEditPayload) {
  const formData = new FormData();

  for (const [key, value] of payload.fields) {
    formData.append(key, value);
  }

  return formData;
}

function isOfflineRoundEditKind(value: unknown): value is OfflineRoundEditKind {
  return typeof value === "string" && offlineRoundEditKinds.includes(value as OfflineRoundEditKind);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
