import { SHOT_MAP_DISTANCE_GUIDE_YARDS, shotMapGuideY } from "@/lib/shot-map-scale";

export function ShotMapDistanceGuides() {
  return (
    <g aria-hidden="true" data-shot-map-distance-guides>
      {SHOT_MAP_DISTANCE_GUIDE_YARDS.map((yards) => {
        const y = shotMapGuideY(yards);

        return (
          <g key={yards}>
            <line
              x1="12"
              x2="88"
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.2)"
              strokeDasharray="1.5 2.5"
              strokeWidth="0.45"
              vectorEffect="non-scaling-stroke"
            />
            <rect x="12.5" y={y - 2.3} width="12" height="3.7" rx="0.9" fill="rgba(5,44,23,0.6)" />
            <text
              x="13.6"
              y={y + 0.25}
              fill="rgba(255,255,255,0.92)"
              fontSize="2.1"
              fontWeight="700"
            >
              {yards} yd
            </text>
          </g>
        );
      })}
    </g>
  );
}
