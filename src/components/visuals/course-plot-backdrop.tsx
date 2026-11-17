import { useId } from "react";

/** Decorative plot art. The parent chart owns every scale, grid and hit test. */
export function CoursePlotBackdrop({
  view,
  x,
  y,
  width,
  height,
}: {
  view: "fairway" | "range";
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const id = useId();
  const fairway =
    "M135 410 C153 343 108 331 111 266 S176 193 143 125 S140 51 169 20 Q194 3 211 27 C237 70 196 115 212 165 S253 238 220 300 S192 369 196 410Z";
  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox="0 0 340 400"
      preserveAspectRatio="none"
      aria-hidden="true"
      pointerEvents="none"
    >
      <defs>
        <radialGradient id={id + "canopy"} cx="35%" cy="30%" r="70%">
          <stop stopColor="#81a080" />
          <stop offset=".69" stopColor="#678768" />
          <stop offset="1" stopColor="#55745b" />
        </radialGradient>
        <g id={id + "tree"}>
          <path
            d="M-12 3Q-18-9-8-12q6-9 13-3 11-2 12 8 8 11-4 17-6 10-15 3-9 1-10-10Z"
            fill={`url(#${id}canopy)`}
          />
        </g>
        <linearGradient id={id + "grass"} x2="1" y2=".45" gradientUnits="objectBoundingBox">
          <stop stopColor="#729875" />
          <stop offset=".55" stopColor="#b1cba0" />
          <stop offset="1" stopColor="#799b78" />
        </linearGradient>
        <linearGradient id={id + "sky"} x2="0" y2="1">
          <stop stopColor="#d7e6ed" />
          <stop offset=".85" stopColor="#f5f0db" />
          <stop offset="1" stopColor="#e3e8d6" />
        </linearGradient>
        <pattern
          id={id + "stripes"}
          width="26"
          height="32"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-17)"
        >
          <rect width="26" height="15" fill="#fff" opacity=".13" />
        </pattern>
      </defs>
      {view === "fairway" ? (
        <>
          <rect width="340" height="400" fill="#76957a" />
          <g opacity=".82">
            {[
              [13, 22, 1.8],
              [41, 45, 1.3],
              [12, 63, 1.5],
              [52, 10, 0.95],
              [306, 22, 1.6],
              [338, 35, 2],
              [310, 64, 1.3],
              [35, 163, 1.3],
              [14, 186, 1.9],
              [36, 213, 1.1],
              [296, 299, 1.6],
              [319, 326, 1.8],
              [333, 289, 0.9],
              [267, 364, 1.1],
              [290, 385, 1.7],
              [9, 380, 1.4],
            ].map(([x, y, scale]) => (
              <use
                key={x + "-" + y}
                href={"#" + id + "tree"}
                transform={`translate(${x} ${y}) scale(${scale})`}
              />
            ))}
          </g>
          <path d={fairway} fill="none" stroke="#92af88" strokeWidth="24" />
          <path d={fairway} fill={`url(#${id}grass)`} />
          <path d={fairway} fill={`url(#${id}stripes)`} />
          <g fill="#e6d6aa" stroke="#a6a07c" strokeWidth="2">
            <path d="M139 48c-9 4-19 0-23 10s1 16 9 14 7-12 14-14 7-14 0-10Z" />
            <path d="M207 51c7-1 6-12 14-11s14 10 9 15-12 4-14 10-13 6-13 0 6-8 4-14Z" />
            <path d="M219 214c7-15 20-18 26-9s-4 16-7 23 2 14-8 18-24-4-20-13 9-10 9-19Z" />
          </g>
          <path
            d="M153 35c-4-12 6-22 19-23s32 3 35 15-7 24-21 25-29-5-33-17Z"
            fill="#bdd4a4"
            stroke="#98b78b"
            strokeWidth="3"
          />
          <path d="M175 32V13" stroke="#425c44" strokeWidth="1.6" />
          <path d="M176 13l13 4-13 4Z" fill="#faf8e9" />
        </>
      ) : (
        <>
          <rect width="340" height="400" fill={`url(#${id}sky)`} />
          <path d="M0 342q39-31 75-12t62-5 74 8 74-16 55 7v76H0Z" fill="#b2c5ad" />
          <path
            d="M0 347v-10l3-8 3 7 4-11 6 13 4-8 3 7 4-5 5 12 9-4 3-8 4 8 4-17 6 12 5-6 5 9 8-2 3-8 6 10 13 3 9-6 6 7 19-3 11 5 12-6 8 5 18-4 11 4 17-6 7 4 11-5 7 3 5-9 5 7 8-11 6 9 6-6 6 3 5-15 7 10 4-6 7 9 9-5 14 7v35H0Z"
            fill="#9db69d"
          />
          <path d="M0 354q49-13 90-8t72-3 83-3 95-12v72H0Z" fill="#93ab91" />
          <path d="M0 358q95-16 174-4t166-13v59H0Z" fill="#c6d6ad" />
          <path d="M0 388l340-40v9L30 400H0Zm127 12 213-26v8l-153 18Z" fill="#afc596" />
        </>
      )}
    </svg>
  );
}
