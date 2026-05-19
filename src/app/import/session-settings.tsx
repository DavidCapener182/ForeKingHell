"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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
    <Card className="premium-card">
      <CardHeader>
        <CardTitle>Step 2: Confirm session</CardTitle>
        <CardDescription>Type, date, unit fallback, and course details if needed.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="session-date">Session date</FieldLabel>
            <Input
              id="session-date"
              type="date"
              value={sessionDate}
              onChange={(event) => onSessionDateChange(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="session-type">Session type</FieldLabel>
            <Select
              value={sessionType}
              onValueChange={(value) => onSessionTypeChange(value as SessionType)}
            >
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
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="distance-unit">Fallback distance unit</FieldLabel>
          <Select
            value={distanceUnit}
            onValueChange={(value) => onDistanceUnitChange(value as DistanceUnit)}
          >
            <SelectTrigger id="distance-unit" className="w-full">
              <SelectValue placeholder="Yards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yards">Yards</SelectItem>
              <SelectItem value="meters">Metres</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            Saved shot distances are normalized to yards. Apex is normalized to feet. Detected
            units: {detectedUnits.length > 0 ? detectedUnits.join(", ") : "none yet"}.
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  );
}
