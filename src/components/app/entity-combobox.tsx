"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type EntityComboboxOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function EntityCombobox({
  value,
  onValueChange,
  options,
  label,
  placeholder = "Choose an option",
  searchPlaceholder = "Search…",
  emptyLabel = "No matching option.",
  customValueLabel,
  onCustomValue,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: EntityComboboxOption[];
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  customValueLabel?: (query: string) => string | null;
  onCustomValue?: (query: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const customLabel = customValueLabel?.(query.trim()) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {customLabel && onCustomValue ? (
              <CommandGroup heading="Use entered value">
                <CommandItem
                  value={`${query} ${customLabel}`}
                  onSelect={() => {
                    onCustomValue(query.trim());
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {customLabel}
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading={label}>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description ?? ""}`}
                  disabled={option.disabled}
                  data-checked={value === option.value || undefined}
                  onSelect={() => {
                    onValueChange(option.value);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === option.value ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-xs text-muted-foreground group-data-[selected=true]/command-item:text-primary-foreground/75">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
