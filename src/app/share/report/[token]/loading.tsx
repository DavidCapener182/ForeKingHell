export default function SharedCoachReportLoading() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div
        className="mx-auto grid w-full max-w-5xl gap-5"
        aria-busy="true"
        aria-label="Loading coach report"
      >
        <div className="h-52 animate-pulse rounded-3xl bg-muted" />
        <div className="h-72 animate-pulse rounded-3xl bg-muted" />
      </div>
    </main>
  );
}
