import { projectedLandingEllipse } from "@/lib/course-twin-mobile-plan";

export function landingContours(cloud: [number, number][], clubCount: number) {
  if (clubCount !== 1 || cloud.length < 4) return null;
  const ellipse = projectedLandingEllipse(cloud);
  if (!ellipse || ellipse.ry <= ellipse.rx * 1e-8) return null;
  // Scale the covariance ellipse by ranked observed distances, not a normality assumption.
  const angle = (ellipse.angle * Math.PI) / 180;
  const radii = cloud
    .map(([x, y]) => {
      const dx = x - ellipse.cx;
      const dy = y - ellipse.cy;
      return Math.hypot(
        (dx * Math.cos(angle) + dy * Math.sin(angle)) / ellipse.rx,
        (dy * Math.cos(angle) - dx * Math.sin(angle)) / ellipse.ry,
      );
    })
    .sort((a, b) => a - b);
  return {
    ...ellipse,
    inner: radii[Math.ceil(radii.length * 0.5) - 1]!,
    outer: radii[Math.ceil(radii.length * 0.8) - 1]!,
  };
}

// Trigonometry differs by a few ulps between Node and WebKit/Chromium.
const svgPoint = (value: number) => Number(value.toFixed(3));

export function LandingContours({
  cloud,
  clubCount,
  clipId,
}: {
  cloud: [number, number][];
  clubCount: number;
  clipId: string;
}) {
  const contour = landingContours(cloud, clubCount);
  if (!contour) return null;
  return (
    <g aria-hidden="true" pointerEvents="none" clipPath={`url(#${clipId})`}>
      <g
        transform={`translate(${svgPoint(contour.cx)} ${svgPoint(contour.cy)}) rotate(${svgPoint(contour.angle)})`}
      >
        {[contour.outer, contour.inner].map((radius, index) => (
          <ellipse
            key={index}
            rx={svgPoint(contour.rx * radius)}
            ry={svgPoint(contour.ry * radius)}
            fill={index ? "var(--chart-positive,#075F36)" : "var(--chart-comparison,#1555d6)"}
            fillOpacity=".06"
            stroke={index ? "var(--chart-positive,#075F36)" : "var(--chart-comparison,#1555d6)"}
            strokeWidth="1.5"
            strokeDasharray={index ? undefined : "7 5"}
          />
        ))}
      </g>
    </g>
  );
}
