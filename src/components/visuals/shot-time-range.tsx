export type ShotTimeRange = { from: string; to: string };
export const allShotTimes: ShotTimeRange = { from: "", to: "" };

export function withinShotTime(shotAt: string | null | undefined, range: ShotTimeRange) {
  if (!range.from && !range.to) return true;
  if (!shotAt) return false;
  const time = Date.parse(shotAt);
  // Native datetime-local inputs have minute precision; include the full ending minute.
  return (
    Number.isFinite(time) &&
    (!range.from || time >= Date.parse(range.from)) &&
    (!range.to || time < Date.parse(range.to) + 60_000)
  );
}

export function ShotTimeFilter({
  range,
  onChange,
}: {
  range: ShotTimeRange;
  onChange: (range: ShotTimeRange) => void;
}) {
  return (
    <details className="min-w-0 text-sm">
      <summary className="cursor-pointer font-medium">
        Shot time range{range.from || range.to ? " · filtered" : ""}
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(["from", "to"] as const).map((key) => (
          <label className="grid min-w-0 gap-1" key={key}>
            {key === "from" ? "From" : "Through"} (local time)
            <input
              type="datetime-local"
              className="min-w-0 w-full rounded border bg-background p-2"
              value={range[key]}
              onChange={(e) => onChange({ ...range, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {range.from && range.to && range.from > range.to && (
        <p role="status">The end must be on or after the start.</p>
      )}
    </details>
  );
}
