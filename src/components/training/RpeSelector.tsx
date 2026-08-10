import { cn } from "@/lib/utils";

type RpeSelectorProps = {
  name?: string;
  defaultValue?: number;
  idPrefix?: string;
  compact?: boolean;
};

const rpeDescriptions = [
  "Very easy / light putting",
  "Casual putting or short practice",
  "Easy range session",
  "Normal practice",
  "18-hole round in cart",
  "18-hole walking round or focused session",
  "Hard practice or competitive round",
  "Tournament, hilly walk or high pressure",
  "Very hard speed or technical session",
  "Max effort speed training / long intense session",
];

export function RpeSelector({
  name = "rpe",
  defaultValue = 5,
  idPrefix = "rpe",
  compact = false,
}: RpeSelectorProps) {
  return (
    <fieldset className="grid gap-2">
      <legend
        className={
          compact
            ? "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            : "text-sm font-semibold text-foreground"
        }
      >
        {compact ? "Edit RPE" : "How demanding was this session overall?"}
      </legend>
      {!compact ? (
        <p className="text-sm leading-5 text-muted-foreground">
          Consider physical effort, mental pressure, weather, walking, repetition and how tired your
          swing felt at the end.
        </p>
      ) : null}
      <div
        className={cn(
          "grid gap-2",
          compact
            ? "grid-cols-5 2xl:grid-cols-10"
            : "grid-cols-2 sm:grid-cols-5 min-[1700px]:grid-cols-10",
        )}
      >
        {rpeDescriptions.map((description, index) => {
          const value = index + 1;
          const id = `${idPrefix}-${value}`;

          return (
            <label
              key={value}
              htmlFor={id}
              className={cn(
                "group relative grid cursor-pointer content-start gap-1 rounded-lg border border-border bg-card p-2 text-left shadow-sm transition-colors motion-reduce:transition-none hover:border-emerald-300 hover:bg-emerald-50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30",
                "has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 has-[:checked]:ring-2 has-[:checked]:ring-emerald-700/15 dark:has-[:checked]:border-emerald-500 dark:has-[:checked]:bg-emerald-950/40 dark:has-[:checked]:ring-emerald-400/20",
                compact ? "min-h-12 place-items-center text-center" : "min-h-24",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={value}
                defaultChecked={value === defaultValue}
                className="sr-only"
              />
              <span className="text-lg font-semibold tracking-normal text-foreground">{value}</span>
              {!compact ? (
                <span className="text-xs leading-4 text-muted-foreground">{description}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
