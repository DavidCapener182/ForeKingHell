"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
export function ComparisonSearchSheet({
  label,
  value,
  options,
  onValueChange,
  description = "Search available owned session records.",
  entity = "session",
}: {
  description?: string;
  entity?: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string; description?: string; disabled?: boolean }>;
  onValueChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const visible = options.filter((option) =>
    `${option.label} ${option.description ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-14 min-w-0 flex-col items-start whitespace-normal text-left"
        >
          <span className="text-xs text-muted-foreground">{label}</span>
          <span>
            {options.find((option) => option.value === value)?.label ??
              `Selected ${entity} unavailable`}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <Input
            aria-label={`Search ${label.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="mt-2 text-sm" role="status">
            {visible.length} results
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {visible.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              disabled={option.disabled}
              aria-pressed={value === option.value}
              className="h-auto min-h-14 w-full flex-col items-start whitespace-normal text-left"
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </Button>
          ))}
          {!visible.length && <p>No matching {entity}. Try another search.</p>}
        </div>
        <SheetClose asChild>
          <Button variant="outline" className="m-4 min-h-11">
            Close {entity} search
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
