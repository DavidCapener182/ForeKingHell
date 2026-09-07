"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDot,
  Dumbbell,
  Flag,
  Trophy,
  Target,
  Package,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
type TimelineCategory = "Practice" | "Round" | "PB" | "Goal change" | "Bag change" | "Confidence";

export type TimelineStoryItem = {
  id: string;
  category: TimelineCategory;
  dateLabel: string;
  sortTime: number;
  title: string;
  detail: string;
  href: string;
};

export function TimelineStory({ items }: { items: TimelineStoryItem[] }) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [category, setCategory] = useState("all");
  const filteredItems =
    category === "all" ? items : items.filter((item) => item.category === category);
  const visibleItems = filteredItems.slice(0, visibleCount);
  return (
    <section
      className="overflow-hidden rounded-[1.75rem] border border-border bg-card"
      aria-labelledby="progress-timeline-title"
      data-progress-timeline-story
    >
      <div className="grid gap-3 border-b border-border p-5">
        <h2 id="progress-timeline-title" className="text-xl font-semibold">
          Evidence timeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Dated sessions, saved equipment and milestones. Undated saved goals remain labelled.
        </p>
        <UntitledSelect
          label="Event type"
          name="eventType"
          value={category}
          options={[
            { value: "all", label: "All events" },
            ...Array.from(new Set(items.map((item) => item.category))).map((value) => ({
              value,
              label: value,
            })),
          ]}
          onValueChange={(value) => {
            setCategory(value);
            setVisibleCount(12);
          }}
        />
      </div>

      <ol className="divide-y divide-border">
        {visibleItems.map((item, index) => {
          const Icon = timelineIcon(item.category);
          return (
            <li
              key={item.id}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-5 py-5 sm:grid-cols-[8rem_auto_minmax(0,1fr)_auto] sm:items-center sm:px-8"
            >
              <time className="col-start-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:col-start-1">
                {item.dateLabel}
              </time>
              <span className="relative row-span-3 grid size-10 place-items-center rounded-full border border-border bg-background text-primary sm:row-span-1">
                <Icon className="size-4" aria-hidden="true" />
                {index < visibleItems.length - 1 ? (
                  <span
                    className="absolute left-1/2 top-full h-5 w-px -translate-x-1/2 bg-border sm:hidden"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
              <div className="col-start-2 min-w-0 sm:col-start-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                    {item.category}
                  </span>
                  <CircleDot className="size-2 text-border" aria-hidden="true" />
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="col-start-2 w-fit rounded-full px-0 sm:col-start-4 sm:px-3"
              >
                <Link href={item.href} prefetch={false}>
                  Review
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </li>
          );
        })}
      </ol>
      {filteredItems.length === 0 ? (
        <div className="grid gap-3 p-5">
          <p>No dated history is available yet.</p>
          <Link
            href="/import"
            className="inline-flex min-h-11 items-center font-semibold text-primary underline"
          >
            Add a measured session
          </Link>
        </div>
      ) : null}
      {visibleItems.length < filteredItems.length ? (
        <div className="p-5">
          <Button variant="outline" onClick={() => setVisibleCount((count) => count + 12)}>
            Load more events ({filteredItems.length - visibleItems.length} remaining)
          </Button>
        </div>
      ) : null}
      <p className="px-5 pb-5 text-sm text-muted-foreground" role="status">
        {visibleItems.length} of {filteredItems.length} matching events. Training history covers the
        loaded year; bag changes include the six most recent saved snapshots.
      </p>
    </section>
  );
}

function timelineIcon(category: TimelineCategory) {
  if (category === "Practice") return Dumbbell;
  if (category === "Round") return Flag;
  if (category === "PB") return Trophy;
  if (category === "Goal change") return Target;
  if (category === "Bag change") return Package;
  return Check;
}
