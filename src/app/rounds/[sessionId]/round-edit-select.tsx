"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type RoundEditSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type RoundEditSelectProps = {
  name: string;
  defaultValue?: string;
  options: readonly RoundEditSelectOption[];
  placeholder?: string;
  triggerClassName?: string;
  native?: boolean;
  ariaLabel?: string;
};

export function RoundEditSelect({
  name,
  defaultValue,
  options,
  placeholder,
  triggerClassName,
  native = false,
  ariaLabel,
}: RoundEditSelectProps) {
  if (native) {
    return (
      <select
        name={name}
        defaultValue={defaultValue}
        aria-label={ariaLabel}
        className={cn(
          "min-h-11 min-w-0 rounded-lg border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          triggerClassName,
        )}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
