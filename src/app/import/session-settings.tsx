"use client";
import { UntitledSelect } from "@/components/untitled-ui/form-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { DistanceUnit } from "@/lib/rapsodo/parser";
import type { SessionType } from "./import-types";
const formatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
export function SessionSettings({
  sessionDate,
  sessionType,
  distanceUnit,
  detectedUnits,
  detectedSessionDateIso,
  onSessionDateChange,
  onSessionTypeChange,
  onDistanceUnitChange,
  onConfirm,
  confirmed = false,
}: {
  sessionDate: string;
  sessionType: SessionType;
  distanceUnit: DistanceUnit;
  detectedUnits: string[];
  detectedSessionDateIso: string | null;
  onSessionDateChange: (value: string) => void;
  onSessionTypeChange: (value: SessionType) => void;
  onDistanceUnitChange: (value: DistanceUnit) => void;
  onConfirm?: () => void;
  confirmed?: boolean;
}) {
  const invalidDate =
    !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || !Number.isFinite(Date.parse(sessionDate));
  return (
    <Card className="shadow-sm" data-import-session-settings id="import-settings">
      <CardHeader>
        <CardTitle>Confirm session settings</CardTitle>
        <CardDescription>
          Choose the saved date and session type. Source units take priority over the fallback.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="session-date">Session date</FieldLabel>
            <Input
              id="session-date"
              type="date"
              required
              value={sessionDate}
              aria-invalid={invalidDate}
              aria-describedby="session-date-help"
              className="min-h-11"
              onChange={(event) => onSessionDateChange(event.target.value)}
            />
            <FieldDescription id="session-date-help">
              {invalidDate
                ? "Choose a valid session date."
                : detectedSessionDateIso
                  ? `CSV title date: ${formatter.format(new Date(detectedSessionDateIso))}. Your chosen date above will be saved.`
                  : "Confirm the date before saving."}
            </FieldDescription>
            {detectedSessionDateIso ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => onSessionDateChange(detectedSessionDateIso.slice(0, 10))}
              >
                Use detected date
              </Button>
            ) : null}
          </Field>
          <UntitledSelect
            label="Session type"
            name="session-type"
            value={sessionType}
            onValueChange={(value) => onSessionTypeChange(value as SessionType)}
            options={[
              { value: "range", label: "Range" },
              { value: "round", label: "Round" },
              { value: "simulator", label: "Simulator" },
              { value: "simulated_course", label: "Simulated course" },
            ]}
          />
        </div>
        <UntitledSelect
          label="Fallback distance unit"
          name="distance-unit"
          value={distanceUnit}
          onValueChange={(value) => onDistanceUnitChange(value as DistanceUnit)}
          options={[
            { value: "yards", label: "Yards" },
            { value: "meters", label: "Metres" },
          ]}
          description={`Used only when the source has no recognised distance unit. Saved distances use yards; apex uses feet. Detected units: ${detectedUnits.length ? detectedUnits.join(", ") : "none yet"}.`}
        />
        {onConfirm ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <Button type="button" className="min-h-11" disabled={invalidDate} onClick={onConfirm}>
              {confirmed ? "Settings confirmed" : "Confirm settings"}
            </Button>
            <a className="inline-flex min-h-11 items-center text-sm underline" href="#import-files">
              Back to files
            </a>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
