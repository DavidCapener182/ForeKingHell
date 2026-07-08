import { clubSortValue, formatClubType } from "@/lib/club-format";

export type BagOrderInput = {
  id: string;
  type: string;
  bagSection?: string | null;
  bagPosition?: number | null;
};

export type EquipmentSnapshotClub = BagOrderInput & {
  brand?: string | null;
  model?: string | null;
  confidence?: number | null;
  carryYd?: number | null;
};

export type EquipmentSnapshotItem = {
  clubId: string;
  label: string;
  section: string;
  position: number;
  brandModel: string;
  confidence: number | null;
  carryYd: number | null;
};

export function defaultBagSection(clubType: string) {
  if (clubType === "driver") return "driver";
  if (["gw", "aw", "sw", "lw"].includes(clubType)) return "wedges";
  if (/[wh]$/.test(clubType) || clubType === "hybrid" || clubType === "utility") return "woods";
  if (clubType.endsWith("i") || clubType === "pw") return "irons";
  if (clubType === "putter") return "putter";
  return "main";
}

export function defaultBagPosition(clubType: string) {
  return clubSortValue(clubType) * 10;
}

export function normalizeBagOrder<T extends BagOrderInput>(
  clubs: T[],
): Array<T & { bagSection: string; bagPosition: number }> {
  return [...clubs]
    .map((club) => ({
      ...club,
      bagSection: cleanSection(club.bagSection) ?? defaultBagSection(club.type),
      bagPosition:
        typeof club.bagPosition === "number" && Number.isFinite(club.bagPosition)
          ? Math.round(club.bagPosition)
          : defaultBagPosition(club.type),
    }))
    .sort(
      (left, right) =>
        sectionSortValue(left.bagSection) - sectionSortValue(right.bagSection) ||
        left.bagPosition - right.bagPosition ||
        clubSortValue(left.type) - clubSortValue(right.type),
    );
}

export function buildEquipmentSnapshotPayload(
  clubs: EquipmentSnapshotClub[],
): EquipmentSnapshotItem[] {
  return normalizeBagOrder(clubs).map((club) => ({
    clubId: club.id,
    label: formatClubType(club.type),
    section: club.bagSection,
    position: club.bagPosition,
    brandModel: [club.brand, club.model].filter(Boolean).join(" ") || "Unknown setup",
    confidence: club.confidence ?? null,
    carryYd: club.carryYd ?? null,
  }));
}

function cleanSection(value: string | null | undefined) {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  return normalized || null;
}

function sectionSortValue(section: string) {
  const order = ["driver", "woods", "irons", "wedges", "putter", "main"];
  const index = order.indexOf(section);
  return index === -1 ? order.length : index;
}
