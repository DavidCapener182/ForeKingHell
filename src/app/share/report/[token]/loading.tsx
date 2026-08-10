export default function SharedCoachReportLoading() {
  return (
    <main className="ios-public-auth min-h-dvh bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div
        className="mx-auto grid w-full max-w-5xl gap-4 lg:gap-5 lg:py-8"
        aria-busy="true"
        aria-label="Loading coach report"
      >
        <div className="h-12 animate-pulse rounded-lg bg-muted motion-reduce:animate-none lg:h-52 lg:rounded-3xl" />
        <div className="h-36 animate-pulse rounded-lg bg-muted motion-reduce:animate-none lg:h-72 lg:rounded-3xl" />
        <div className="h-44 animate-pulse rounded-lg bg-muted motion-reduce:animate-none lg:hidden" />
        <p className="sr-only">Loading the frozen coach report.</p>
      </div>
    </main>
  );
}
