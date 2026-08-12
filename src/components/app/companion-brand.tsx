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
        viewBox="0 0 360 220"
        className="pointer-events-none absolute left-1/2 top-[22%] w-[min(92vw,34rem)] -translate-x-1/2 opacity-80"
        aria-hidden
      >
        <path
          d="M42 180 C 110 20, 240 20, 318 176"
          fill="none"
          stroke="rgba(245,181,45,0.9)"
          strokeWidth="3"
          strokeLinecap="round"
          className="companion-launch-trace"
        />
        <circle cx="42" cy="180" r="5" fill="#fff" />
        <circle cx="318" cy="176" r="7" fill="#ef4444" className="animate-pulse" />
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
