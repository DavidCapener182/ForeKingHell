export type BagOrderClubItem = {
  id: string;
  type: string;
  label: string;
  brandModel: string;
  bagSection: string;
  bagPosition: number;
  confidence: number;
  carryLabel: string;
};

export const BAG_SECTIONS = [
  { key: "driver", label: "Driver" },
  { key: "woods", label: "Woods" },
  { key: "irons", label: "Irons" },
  { key: "wedges", label: "Wedges" },
  { key: "putter", label: "Putter" },
] as const;

export function initializeBagOrder(items: BagOrderClubItem[]) {
  return normalizePositions(sortSavedBagOrder(items));
}

export function moveBagClub(
  items: BagOrderClubItem[],
  clubId: string,
  section: string,
  targetId?: string,
) {
  if (targetId === clubId) {
    return items;
  }

  const moving = items.find((item) => item.id === clubId);

  if (!moving) {
    return items;
  }

  const nextSection = knownSection(section);
  const without = items.filter((item) => item.id !== clubId);
  const targetIndex = targetId ? without.findIndex((item) => item.id === targetId) : -1;
  const nextItems = [...without];
  const nextMoving = { ...moving, bagSection: nextSection };

  if (targetIndex >= 0) {
    nextItems.splice(targetIndex, 0, nextMoving);
  } else {
    const lastInSectionIndex = findLastIndex(nextItems, (item) => item.bagSection === nextSection);
    nextItems.splice(lastInSectionIndex + 1, 0, nextMoving);
  }

  return normalizePositions(nextItems);
}

export function moveBagClubWithinSection(
  items: BagOrderClubItem[],
  clubId: string,
  direction: -1 | 1,
) {
  const item = items.find((club) => club.id === clubId);

  if (!item) {
    return items;
  }

  const sectionItems = items.filter((club) => club.bagSection === item.bagSection);
  const currentIndex = sectionItems.findIndex((club) => club.id === clubId);
  const next = sectionItems[currentIndex + direction];

  if (!next) {
    return items;
  }

  const without = items.filter((club) => club.id !== clubId);
  const targetIndex = without.findIndex((club) => club.id === next.id);
  const insertIndex = direction > 0 ? targetIndex + 1 : targetIndex;

  return normalizePositions([
    ...without.slice(0, insertIndex),
    item,
    ...without.slice(insertIndex),
  ]);
}

function normalizePositions(items: BagOrderClubItem[]) {
  const normalized = items.map((item) => ({
    ...item,
    bagSection: knownSection(item.bagSection),
  }));
  const ordered = BAG_SECTIONS.flatMap((section) =>
    normalized.filter((item) => item.bagSection === section.key),
  );
  const positions = new Map<string, number>();

  return ordered.map((item) => {
    const position = (positions.get(item.bagSection) ?? 0) + 10;
    positions.set(item.bagSection, position);
    return { ...item, bagPosition: position };
  });
}

function sortSavedBagOrder(items: BagOrderClubItem[]) {
  return [...items].sort((left, right) => {
    const sectionDelta = sectionSortValue(left.bagSection) - sectionSortValue(right.bagSection);
    return (
      sectionDelta || left.bagPosition - right.bagPosition || left.label.localeCompare(right.label)
    );
  });
}

function knownSection(section: string) {
  return BAG_SECTIONS.some((candidate) => candidate.key === section) ? section : "irons";
}

function sectionSortValue(section: string) {
  const index = BAG_SECTIONS.findIndex((candidate) => candidate.key === section);
  return index === -1 ? BAG_SECTIONS.length : index;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index;
    }
  }

  return -1;
}
