"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { DistanceUnit } from "@/lib/rapsodo/parser";
import type { SessionType } from "@/app/import/import-types";

export function SessionSettings({
  sessionDate,
  sessionType,
  distanceUnit,
  detectedUnits,
  onSessionDateChange,
  onSessionTypeChange,
  onDistanceUnitChange,
}: {
  sessionDate: string;
  sessionType: SessionType;
  distanceUnit: DistanceUnit;
  detectedUnits: string[];
  onSessionDateChange: (value: string) => void;
  onSessionTypeChange: (value: SessionType) => void;
  onDistanceUnitChange: (value: DistanceUnit) => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Step 2: Confirm session</p>
          <p className="text-xs text-muted-foreground">
            Type, date, unit fallback, and course details if needed.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="session-date">
            Session date
          </label>
          <Input
            id="session-date"
            type="date"
            value={sessionDate}
            onChange={(event) => onSessionDateChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="session-type">
            Session type
          </label>
          <Select value={sessionType} onValueChange={(value) => onSessionTypeChange(value as SessionType)}>
            <SelectTrigger id="session-type" className="w-full">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="range">Range</SelectItem>
              <SelectItem value="round">Round</SelectItem>
              <SelectItem value="simulator">Simulator</SelectItem>
              <SelectItem value="simulated_course">Simulated course</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <label className="text-sm font-medium" htmlFor="distance-unit">
          Fallback distance unit
        </label>
        <Select value={distanceUnit} onValueChange={(value) => onDistanceUnitChange(value as DistanceUnit)}>
          <SelectTrigger id="distance-unit" className="w-full">
            <SelectValue placeholder="Yards" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yards">Yards</SelectItem>
            <SelectItem value="meters">Metres</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Saved shot distances are normalized to yards. Apex is normalized to feet. Detected units:{" "}
          {detectedUnits.length > 0 ? detectedUnits.join(", ") : "none yet"}.
        </p>
      </div>
    </div>
  );
}
