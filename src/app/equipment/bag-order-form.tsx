"use client";

import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical, Save } from "lucide-react";

import { saveBagOrderAction } from "@/app/equipment/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const BAG_SECTIONS = [
  { key: "driver", label: "Driver" },
  { key: "woods", label: "Woods" },
  { key: "irons", label: "Irons" },
  { key: "wedges", label: "Wedges" },
  { key: "putter", label: "Putter" },
] as const;

export function BagOrderForm({ clubs }: { clubs: BagOrderClubItem[] }) {
  const [items, setItems] = useState(() => normalizePositions(clubs));
  const grouped = useMemo(() => groupBySection(items), [items]);

  return (
    <form action={saveBagOrderAction} className="grid gap-3">
      {items.map((item) => (
        <input key={item.id} type="hidden" name="clubId" value={item.id} />
      ))}
      {items.map((item) => (
        <input
          key={`${item.id}:section`}
          type="hidden"
          name={`bagSection:${item.id}`}
          value={item.bagSection}
        />
      ))}
      {items.map((item) => (
        <input
          key={`${item.id}:position`}
          type="hidden"
          name={`bagPosition:${item.id}`}
          value={item.bagPosition}
        />
      ))}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {BAG_SECTIONS.map((section) => {
          const sectionItems = grouped.get(section.key) ?? [];

          return (
            <div
              key={section.key}
              className="min-h-44 rounded-lg border border-slate-200 bg-white p-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, section.key)}
            >
              <div className="flex items-center justify-between gap-2 px-1 pb-2">
                <p className="text-sm font-semibold tracking-normal">{section.label}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {sectionItems.length}
                </span>
              </div>
              <div className="grid gap-2">
                {sectionItems.map((club, index) => (
                  <div
                    key={club.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", club.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, section.key, club.id)}
                    className={cn(
                      "group rounded-lg border bg-gradient-to-br from-white to-slate-50 p-2 shadow-sm",
                      "transition hover:border-emerald-300 hover:shadow-md",
                    )}
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
                      <GripVertical
                        className="mt-0.5 size-4 cursor-grab text-slate-400 group-active:cursor-grabbing"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-normal">
                          {club.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {club.brandModel}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <IconButton
                          label={`Move ${club.label} up`}
                          disabled={index === 0}
                          onClick={() => moveWithinSection(club.id, -1)}
                        >
                          <ChevronUp className="size-3.5" />
                        </IconButton>
                        <IconButton
                          label={`Move ${club.label} down`}
                          disabled={index === sectionItems.length - 1}
                          onClick={() => moveWithinSection(club.id, 1)}
                        >
                          <ChevronDown className="size-3.5" />
                        </IconButton>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{club.carryLabel}</span>
                      <span>{club.confidence}% trust</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="rounded-lg bg-[#0B7A3B] text-white hover:bg-[#064E3B]">
          <Save className="size-4" />
          Save bag order
        </Button>
      </div>
    </form>
  );

  function handleDrop(event: DragEvent<HTMLDivElement>, section: string, targetId?: string) {
    event.preventDefault();
    event.stopPropagation();
    const clubId = event.dataTransfer.getData("text/plain");

    if (!clubId) {
      return;
    }

    setItems((current) => moveClub(current, clubId, section, targetId));
  }

  function moveWithinSection(clubId: string, direction: -1 | 1) {
    setItems((current) => {
      const item = current.find((club) => club.id === clubId);

      if (!item) {
        return current;
      }

      const sectionItems = current.filter((club) => club.bagSection === item.bagSection);
      const currentIndex = sectionItems.findIndex((club) => club.id === clubId);
      const next = sectionItems[currentIndex + direction];

      if (!next) {
        return current;
      }

      const without = current.filter((club) => club.id !== clubId);
      const targetIndex = without.findIndex((club) => club.id === next.id);
      const insertIndex = direction > 0 ? targetIndex + 1 : targetIndex;

      return normalizePositions([
        ...without.slice(0, insertIndex),
        item,
        ...without.slice(insertIndex),
      ]);
    });
  }
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function groupBySection(items: BagOrderClubItem[]) {
  const grouped = new Map<string, BagOrderClubItem[]>();

  for (const item of items) {
    grouped.set(item.bagSection, [...(grouped.get(item.bagSection) ?? []), item]);
  }

  return grouped;
}

function moveClub(
  items: BagOrderClubItem[],
  clubId: string,
  section: string,
  targetId?: string,
) {
  const moving = items.find((item) => item.id === clubId);

  if (!moving) {
    return items;
  }

  const without = items.filter((item) => item.id !== clubId);
  const targetIndex = targetId ? without.findIndex((item) => item.id === targetId) : -1;
  const nextItems = [...without];
  const nextMoving = { ...moving, bagSection: section };

  if (targetIndex >= 0) {
    nextItems.splice(targetIndex, 0, nextMoving);
  } else {
    const lastInSectionIndex = findLastIndex(nextItems, (item) => item.bagSection === section);
    nextItems.splice(lastInSectionIndex + 1, 0, nextMoving);
  }

  return normalizePositions(nextItems);
}

function normalizePositions(items: BagOrderClubItem[]) {
  return items
    .map((item) => ({ ...item, bagSection: knownSection(item.bagSection) }))
    .sort((left, right) => {
      const sectionDelta = sectionSortValue(left.bagSection) - sectionSortValue(right.bagSection);
      return (
        sectionDelta ||
        left.bagPosition - right.bagPosition ||
        left.label.localeCompare(right.label)
      );
    })
    .map((item, index, sorted) => {
      const sectionIndex = sorted
        .filter((club) => club.bagSection === item.bagSection)
        .findIndex((club) => club.id === item.id);

      return {
        ...item,
        bagSection: knownSection(item.bagSection),
        bagPosition: (sectionIndex + 1) * 10,
      };
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
