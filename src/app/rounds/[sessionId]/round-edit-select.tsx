"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RoundEditSelectOption = {
  value: string;
  label: string;
};

export type RoundEditSelectProps = {
  name: string;
  defaultValue?: string;
  options: readonly RoundEditSelectOption[];
  placeholder?: string;
  triggerClassName?: string;
};

export function RoundEditSelect({
  name,
  defaultValue,
  options,
  placeholder,
  triggerClassName,
}: RoundEditSelectProps) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
