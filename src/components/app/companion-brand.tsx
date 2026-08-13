import { cn } from "@/lib/utils";

export function CompanionBrandLockup({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center justify-center gap-2", className)}
      aria-label="Launch Monitor World Tour companion"
    >
      <span
        className="size-7 shrink-0 rounded-[0.45rem] bg-[#062846] bg-[url('/brand/lm-world-tour-logo.png')] bg-cover bg-center shadow-sm ring-1 ring-[#d7a92f]/40"
        aria-hidden
      />
      <span className="min-w-0 text-left leading-none">
        <span className="block truncate font-display text-[0.72rem] font-bold uppercase tracking-[0.09em] text-foreground">
          LM World Tour
        </span>
        <span className="mt-0.5 block truncate text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Golf companion
        </span>
      </span>
    </span>
  );
}

export function CompanionLaunchScreen() {
  const tracerPath = "M 46 184 C 128 164 190 104 270 82 C 350 60 432 108 490 178";

  return (
    <main
      className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#031d31] px-6 text-white"
      role="status"
      aria-live="polite"
      aria-label="Loading Launch Monitor World Tour"
      data-companion-launch-screen
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(34,197,94,0.16),transparent_32%),linear-gradient(180deg,#062846_0%,#031d31_58%,#021522_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(175deg,transparent_22%,rgba(11,91,57,0.46)_23%,rgba(2,28,23,0.96)_78%)]" />
      <svg
        viewBox="0 0 540 220"
        className="pointer-events-none absolute left-1/2 top-[16%] w-[min(96vw,44rem)] -translate-x-1/2"
        aria-hidden
      >
        <defs>
          <linearGradient
            id="companion-launch-tracer-gradient"
            x1="46"
            y1="184"
            x2="490"
            y2="82"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#e5b33d" />
            <stop offset="0.48" stopColor="#fff3bd" />
            <stop offset="1" stopColor="#f0c75a" />
          </linearGradient>
          <clipPath id="companion-launch-trace-clip">
            <rect
              x="30"
              y="48"
              width="480"
              height="150"
              className="companion-launch-trace-reveal"
            />
          </clipPath>
        </defs>

        <g data-launch-angle-deg="14">
          <path d="M 24 184 H 112" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <path
            d="M 46 184 L 108 169"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <text
            x="99"
            y="181"
            fill="rgba(255,255,255,0.5)"
            fontSize="9"
            fontWeight="700"
            letterSpacing="0.9"
          >
            14° LAUNCH
          </text>
        </g>

        <path
          d={tracerPath}
          fill="none"
          stroke="rgba(255,255,255,0.13)"
          strokeWidth="2"
          strokeLinecap="round"
          className="companion-launch-trace-rail"
        />

        <g clipPath="url(#companion-launch-trace-clip)" className="companion-launch-trace-flight">
          <path
            d={tracerPath}
            fill="none"
            stroke="rgba(229,179,61,0.32)"
            strokeWidth="10"
            strokeLinecap="round"
            className="companion-launch-trace-glow"
          />
          <path
            d={tracerPath}
            fill="none"
            stroke="url(#companion-launch-tracer-gradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="companion-launch-trace"
          />
        </g>

        <circle cx="46" cy="184" r="8" fill="none" stroke="rgba(255,255,255,0.16)" />
        <circle cx="46" cy="184" r="4.5" fill="#f8fafc" />
      </svg>
      <div className="relative z-10 grid place-items-center text-center">
        <div
          className="size-28 rounded-[1.65rem] bg-[#062846] bg-[url('/brand/lm-world-tour-logo.png')] bg-cover bg-center shadow-[0_24px_70px_rgba(0,0,0,0.38)] ring-1 ring-[#e5b33d]/60"
          aria-hidden
        />
        <p className="mt-6 font-display text-2xl font-bold uppercase tracking-[0.08em]">
          Launch Monitor
        </p>
        <p className="font-display text-xl font-semibold uppercase tracking-[0.18em] text-[#e5b33d]">
          World Tour
        </p>
        <p className="mt-3 text-sm font-medium text-white/68">Preparing LM World Tour…</p>
        <span className="mt-5 h-1 w-24 overflow-hidden rounded-full bg-white/15">
          <span className="companion-launch-progress block h-full w-2/5 rounded-full bg-[#e5b33d]" />
        </span>
      </div>
    </main>
  );
}
