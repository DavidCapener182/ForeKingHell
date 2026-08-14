"use client";

import { useMemo, useState, type DragEvent } from "react";
import { ChevronDown, ChevronUp, GripVertical, Save } from "lucide-react";

import { saveBagOrderAction } from "@/app/equipment/actions";
import {
  BAG_SECTIONS,
  initializeBagOrder,
  moveBagClub,
  moveBagClubWithinSection,
  type BagOrderClubItem,
} from "@/app/equipment/bag-order-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type { BagOrderClubItem } from "@/app/equipment/bag-order-state";

export function BagOrderForm({ clubs }: { clubs: BagOrderClubItem[] }) {
  const [items, setItems] = useState(() => initializeBagOrder(clubs));
  const grouped = useMemo(() => groupBySection(items), [items]);

  return (
    <form action={saveBagOrderAction} className="grid gap-3" data-bag-order-form>
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {BAG_SECTIONS.map((section) => {
          const sectionItems = grouped.get(section.key) ?? [];

          return (
            <div
              key={section.key}
              className="min-h-44 rounded-lg border border-border bg-card p-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, section.key)}
            >
              <div className="flex items-center justify-between gap-2 px-1 pb-2">
                <p className="text-sm font-semibold tracking-normal">{section.label}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
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
                      "group rounded-lg border bg-gradient-to-br from-card to-muted/40 p-2 shadow-sm",
                      "transition hover:border-primary/50 hover:shadow-md",
                    )}
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
                      <GripVertical
                        className="mt-0.5 size-4 cursor-grab text-muted-foreground group-active:cursor-grabbing"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-normal">
                          {club.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{club.brandModel}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Move ${club.label} up`}
                          title={`Move ${club.label} up`}
                          disabled={index === 0}
                          onClick={() => moveWithinSection(club.id, -1)}
                          className="size-11 shrink-0 touch-manipulation motion-reduce:transition-none"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Move ${club.label} down`}
                          title={`Move ${club.label} down`}
                          disabled={index === sectionItems.length - 1}
                          onClick={() => moveWithinSection(club.id, 1)}
                          className="size-11 shrink-0 touch-manipulation motion-reduce:transition-none"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <label
                      className="mt-2 grid gap-1 text-xs font-medium text-muted-foreground"
                      data-bag-order-non-drag
                    >
                      <span>Bag section</span>
                      <Select
                        value={club.bagSection}
                        onValueChange={(value) => moveToSection(club.id, value)}
                      >
                        <SelectTrigger
                          aria-label={`Move ${club.label} to bag section`}
                          className="min-h-11 w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BAG_SECTIONS.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
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
        <Button type="submit" className="min-h-11 rounded-lg">
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

    setItems((current) => moveBagClub(current, clubId, section, targetId));
  }

  function moveWithinSection(clubId: string, direction: -1 | 1) {
    setItems((current) => moveBagClubWithinSection(current, clubId, direction));
  }

  function moveToSection(clubId: string, section: string) {
    setItems((current) => moveBagClub(current, clubId, section));
  }
}

function groupBySection(items: BagOrderClubItem[]) {
  const grouped = new Map<string, BagOrderClubItem[]>();

  for (const item of items) {
    grouped.set(item.bagSection, [...(grouped.get(item.bagSection) ?? []), item]);
  }

  return grouped;
}
