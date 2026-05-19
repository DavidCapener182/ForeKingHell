"use client";

import { useMemo, useState } from "react";
import { CalendarDays, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DateFilterPopoverProps = {
  name: string;
  label: string;
  defaultValue?: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function DateFilterPopover({ name, label, defaultValue = "" }: DateFilterPopoverProps) {
  const initialDate = useMemo(() => parseIsoDate(defaultValue), [defaultValue]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
  const value = selectedDate ? toIsoDate(selectedDate) : "";

  return (
    <div className="grid gap-1 text-sm font-medium">
      <span>{label}</span>
      <input type="hidden" name={name} value={value} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 justify-start bg-white/90 font-normal"
          >
            <CalendarDays className="size-4" />
            {selectedDate ? dateFormatter.format(selectedDate) : "Any date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            captionLayout="dropdown"
          />
          {selectedDate ? (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setSelectedDate(undefined)}
              >
                <X className="size-4" />
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function parseIsoDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
