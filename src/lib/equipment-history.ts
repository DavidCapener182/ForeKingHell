export type EquipmentHistoryInput = {
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  loftDeg?: number | null;
  lieDeg?: number | null;
  shaft?: string | null;
  swingWeight?: string | null;
  notes?: string | null;
};

export type NormalizedEquipmentHistory = {
  effectiveFrom: Date;
  effectiveTo: Date | null;
  loftDeg: number | null;
  lieDeg: number | null;
  shaft: string | null;
  swingWeight: string | null;
  notes: string | null;
};

export function normalizeEquipmentHistory(input: EquipmentHistoryInput, now = new Date()): NormalizedEquipmentHistory {
  const effectiveFrom = parseDate(input.effectiveFrom) ?? now;
  const effectiveTo = parseDate(input.effectiveTo);

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new Error("Equipment effective end date cannot be before the start date.");
  }

  return {
    effectiveFrom,
    effectiveTo,
    loftDeg: normalizeDegree(input.loftDeg, 0, 80, "Loft"),
    lieDeg: normalizeDegree(input.lieDeg, 40, 80, "Lie"),
    shaft: normalizeText(input.shaft, 180),
    swingWeight: normalizeText(input.swingWeight, 40),
    notes: normalizeText(input.notes, 1000),
  };
}

function normalizeDegree(value: number | null | undefined, min: number, max: number, label: string) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max} degrees.`);
  }

  return Math.round(value * 10) / 10;
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
