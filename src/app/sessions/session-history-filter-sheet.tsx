"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function SessionHistoryFilterSheet({
  label,
  value,
  options,
  onChange,
  title,
  description,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  title?: string;
  description?: string;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {label}
          {value !== "all" ? (
            <Badge variant="secondary" className="max-w-24 truncate">
              {selectedLabel}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(24rem,92vw)] sm:max-w-96">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{title ?? `Filter by ${label.toLowerCase()}`}</SheetTitle>
          <SheetDescription>
            {description ??
              "Keep the history focused without changing the underlying session record."}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 overflow-y-auto px-4 pb-4">
          {options.map((option) => (
            <SheetClose asChild key={option.value}>
              <Button
                type="button"
                variant={option.value === value ? "secondary" : "ghost"}
                className="min-h-11 justify-start"
                onClick={() => onChange(option.value)}
                aria-pressed={option.value === value}
              >
                <span className="grid size-4 place-items-center" aria-hidden>
                  {option.value === value ? <Check className="size-4" /> : null}
                </span>
                {option.label}
              </Button>
            </SheetClose>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
