"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type DeliveryObservation } from "@/lib/club-delivery";

export function formatSignedDegrees(value: number | null | undefined) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
      }).format(value) + "°";
}

export default function ClubDeliveryChart({
  clubName,
  clubPath,
  faceAngle,
  rows,
}: {
  clubName: string;
  clubPath: number | null;
  faceAngle: number | null;
  rows: DeliveryObservation[];
}) {
  const [observed, setObserved] = useState(false);
  const landings = rows.flatMap((row) =>
    row.side !== null && row.carry !== null && row.carry > 0
      ? [{ side: row.side, carry: row.carry }]
      : [],
  );
  const scale = Math.min(
    170 / Math.max(1, ...landings.map((row) => row.carry)),
    124 / Math.max(1, ...landings.map((row) => Math.abs(row.side))),
  );
  const delta = faceAngle !== null && clubPath !== null ? faceAngle - clubPath : null;
  return (
    <figure className="grid gap-2">
      <div className="flex flex-wrap gap-2" aria-label="Chart view">
        {["Delivery", "Observed carry"].map((name, i) => (
          <Button
            key={name}
            size="sm"
            variant={observed === Boolean(i) ? "default" : "outline"}
            aria-pressed={observed === Boolean(i)}
            onClick={() => setObserved(Boolean(i))}
          >
            {name}
          </Button>
        ))}
      </div>
      <div className="clubhouse-chart-plot rounded-xl border bg-muted/30 px-3 py-2">
        <svg
          role="img"
          aria-label={
            observed
              ? clubName + " recorded carry positions"
              : clubName +
                " delivery. Club path " +
                formatSignedDegrees(clubPath) +
                ", face " +
                formatSignedDegrees(faceAngle)
          }
          viewBox="0 0 300 224"
          className="mx-auto block h-auto max-h-80 w-full"
        >
          <line
            x1="150"
            y1="26"
            x2="150"
            y2="218"
            stroke="currentColor"
            opacity=".85"
            strokeDasharray="2 3"
          />
          <text x="150" y="16" textAnchor="middle" fill="currentColor" fontSize="11">
            Target · 0°
          </text>
          {observed ? (
            landings.map((row, i) => (
              <circle
                key={i}
                cx={150 + row.side * scale}
                cy={202 - row.carry * scale}
                r="3"
                fill="var(--delivery-face, #111827)"
                opacity=".7"
              >
                <title>
                  {row.carry} yd carry, {row.side} yd lateral
                </title>
              </circle>
            ))
          ) : (
            <>
              {clubPath !== null && (
                <g
                  transform={`rotate(${clubPath} 150 202)`}
                  stroke="var(--delivery-path, #B91C1C)"
                  fill="none"
                  strokeWidth="2.5"
                >
                  <path d="M150 202V30m-4 7 4-7 4 7" />
                </g>
              )}
              {faceAngle !== null && (
                <g
                  transform={`rotate(${faceAngle} 150 202)`}
                  stroke="var(--delivery-face, #111827)"
                  fill="none"
                  strokeWidth="2.5"
                >
                  <path d="M150 202V68" strokeDasharray="5 3" />
                  <path d="m146 73 4-7 4 7" />
                </g>
              )}
              {delta !== null && (
                <g transform="translate(211 98)">
                  <rect
                    x="-19"
                    y="-21"
                    width="94"
                    height="108"
                    rx="6"
                    fill="var(--card)"
                    stroke="var(--border)"
                  />
                  <text x="27" y="-7" textAnchor="middle" fill="currentColor" fontSize="10">
                    Illustrative flight
                  </text>
                  <path
                    d={`M24 71 Q${24 + Math.sign(faceAngle!) * 18} 36 ${24 + Math.sign(faceAngle!) * 30 + Math.sign(delta) * 29} 4`}
                    fill="none"
                    stroke="var(--status-success-foreground, #087a3d)"
                    strokeWidth="2"
                    strokeDasharray="3 2"
                  />
                </g>
              )}
            </>
          )}
          <circle cx="150" cy="202" r="4" fill="var(--card)" stroke="currentColor" />
        </svg>
      </div>
      <figcaption className="text-xs leading-5 text-muted-foreground">
        {observed ? (
          landings.length ? (
            landings.length +
            " recorded landing positions. Left and right are relative to the target. Each dot is one shot."
          ) : (
            "No paired carry and lateral measurements for this cohort."
          )
        ) : (
          <>
            <span className="mr-4 inline-flex items-center gap-2">
              <i className="w-5 border-t-2 border-[var(--delivery-path,#B91C1C)]" />
              Club path
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="w-5 border-t-2 border-dashed border-[var(--delivery-face,#111827)]" />
              Clubface
            </span>
            <span className="block">
              Viewed from above, with the target straight ahead. Arrows use true angles. The flight
              sketch shows a possible shape only.
            </span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
