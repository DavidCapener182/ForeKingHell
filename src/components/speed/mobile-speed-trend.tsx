import type { SpeedCentreSession } from "@/lib/speed-training-data";
import { selectMobileSpeedTrend } from "@/lib/mobile-speed-trend";
import { MobileSection } from "@/components/app/mobile-screen";
export function MobileSpeedTrend({ sessions }: { sessions: SpeedCentreSession[] }) {
  const { points, label } = selectMobileSpeedTrend(sessions);
  const values = points.map((point) => point.value);
  const low = values.length ? Math.floor(Math.min(...values) - 1) : 0;
  const high = values.length ? Math.ceil(Math.max(...values) + 1) : 1;
  const first = points[0]?.time ?? 0;
  const last = points.at(-1)?.time ?? first;
  const coordinates = points.map((point) => ({
    x: points.length === 1 ? 150 : 10 + (280 * (point.time - first)) / Math.max(1, last - first),
    y: 90 - (70 * (point.value - low)) / (high - low),
  }));
  return (
    <MobileSection title="7-day training trend">
      {points.length ? (
        <figure className="grid gap-2">
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              {low}–{high} mph
            </span>
            <span>{label}</span>
          </div>
          <svg
            viewBox="0 0 300 105"
            className="h-28 w-full text-primary"
            role="img"
            aria-label={points
              .map(
                (point) =>
                  `${new Date(point.time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${point.value.toFixed(1)} mph`,
              )
              .join("; ")}
          >
            {points.length > 1 ? (
              <polyline
                points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            ) : null}
            {coordinates.map((point, index) => (
              <circle
                key={points[index].id}
                cx={point.x}
                cy={point.y}
                r="3.5"
                fill="currentColor"
              />
            ))}
          </svg>
          <figcaption className="text-xs text-muted-foreground">
            {points.length === 1
              ? "One comparable session. Add another to establish direction."
              : `${points.length} comparable session averages. Same club, implement, source and handedness.`}{" "}
            Playing speed and strike quality remain separate evidence.
          </figcaption>
        </figure>
      ) : (
        <p className="text-sm text-muted-foreground">
          No measured speed sessions in the last seven days. Your older results remain in History.
        </p>
      )}
    </MobileSection>
  );
}
